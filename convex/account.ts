import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { audit, requirePermission, requireUser } from "./lib/access";
import { sendEmail } from "./lib/email";
import { randomToken, sha256 } from "./lib/tokens";

const MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "Use at least 10 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  PASSWORD_HAS_SURROUNDING_WHITESPACE: "Remove spaces at the start or end.",
  PASSWORD_TOO_COMMON: "That password is too common. Choose something harder to guess.",
  INVALID_CREDENTIALS: "Your current password isn't right.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
};

/** Change my password after confirming the current one. */
export const changePassword = mutation({
  args: { current: v.string(), next: v.string() },
  handler: async (ctx, { current, next }) => {
    const user = await requireUser(ctx);
    if (current === next) {
      throw new ConvexError({ code: "INVALID", field: "next", message: "Choose a password different from your current one." });
    }
    const check = await ctx.runMutation(components.authPassword.public.verifyPassword, {
      userId: user._id,
      password: current,
    });
    if (!check.success) {
      throw new ConvexError({
        code: "INVALID",
        field: "current",
        message: MESSAGES[check.userError.error] ?? "Your current password isn't right.",
      });
    }
    // The current password was just verified, which is the case the
    // component's setter is meant for.
    const result = await ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
      userId: user._id,
      password: next,
      minimumLength: 10,
    });
    if (!result.success) {
      throw new ConvexError({
        code: "INVALID",
        field: "next",
        message: MESSAGES[result.userError.error] ?? "Choose a different password.",
      });
    }
    await audit(ctx, { actor: user, action: "user.password_changed", module: "users", targetTable: "users", targetId: user._id });
  },
});

// ---------------------------------------------------------------------------
// Forgot password: emailed link, valid for 1 hour, single use
// ---------------------------------------------------------------------------

const RESET_TTL_MS = 60 * 60 * 1000;


/**
 * Always answers the same way, so it can't be used to find out whether an
 * email address has an account.
 */
export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ConvexError({ code: "INVALID", field: "email", message: "Enter a valid email address." });
    }
    const userId = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username: normalized });
    const id = userId ? ctx.db.normalizeId("users", userId) : null;
    const user = id ? await ctx.db.get(id) : null;
    if (!user || user.status !== "active" || user.deletedAt) return { ok: true };

    await issueReset(ctx, user);
    return { ok: true };
  },
});

export const resetPassword = mutation({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }) => {
    const expired = () =>
      new ConvexError({ code: "INVALID_TOKEN", message: "This link has expired or was already used. Ask for a new one." });
    if (!/^[0-9a-f]{64}$/.test(token)) throw expired();
    const hash = await sha256(token);
    const reset = await ctx.db.query("passwordResets").withIndex("by_token", (q) => q.eq("tokenHash", hash)).unique();
    if (!reset || reset.usedAt || reset.expiresAt < Date.now()) throw expired();
    const user = await ctx.db.get(reset.userId);
    if (!user || user.status !== "active" || user.deletedAt) throw expired();

    const result = await ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
      userId: user._id,
      password,
      minimumLength: 10,
    });
    if (!result.success) {
      throw new ConvexError({
        code: "INVALID",
        field: "password",
        message: MESSAGES[result.userError.error] ?? "Choose a different password.",
      });
    }
    await ctx.db.patch(reset._id, { usedAt: Date.now() });
    // Sign out everywhere: whoever had the old password is logged out.
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId: user._id });
    if (sessions.length > 0) {
      await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds: sessions.map((s) => s.sessionId) });
    }
    await audit(ctx, { actor: user, action: "user.password_reset", module: "users", targetTable: "users", targetId: user._id });
    if (user.email) {
      await sendEmail(ctx, user.email, {
        subject: "Your Event Planner password was changed",
        heading: "Your password was changed",
        body: "You can now log in with your new password. You've been logged out on other devices.",
        footnote: "If you didn't do this, reset your password again right away and contact support.",
      });
    }
    return { ok: true };
  },
});

/** Create a single-use 1-hour reset link and email it (self-serve and A-03). */
export async function issueReset(ctx: MutationCtx, user: Doc<"users">) {
  if (!user.email) return false;
  const normalized = user.email;
    const now = Date.now();
    const recent = await ctx.db
      .query("passwordResets")
      .withIndex("by_user", (q) => q.eq("userId", user._id).gt("createdAt", now - RESET_TTL_MS))
      .collect();
    if (recent.length >= 3) return false; // quietly rate-limited
    // Only the newest link works.
    for (const r of recent) if (!r.usedAt) await ctx.db.patch(r._id, { usedAt: now });

    const token = randomToken();
    await ctx.db.insert("passwordResets", {
      userId: user._id,
      tokenHash: await sha256(token),
      expiresAt: now + RESET_TTL_MS,
      createdAt: now,
    });
    await sendEmail(ctx, normalized, {
      subject: "Reset your Event Planner password",
      heading: "Reset your password",
      body: "Someone asked to reset the password for this account. The link works once and expires in 1 hour.",
      cta: { label: "Choose a new password", href: `/reset-password?token=${token}` },
      footnote: "If this wasn't you, ignore this email. Your password won't change.",
    });
  return true;
}

/** A-03: an admin sends a user a password reset link. */
export const adminSendReset = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const admin = await requirePermission(ctx, "users:resetPassword");
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    if (user.status !== "active") throw new ConvexError({ code: "INVALID", message: "Reactivate the account first." });
    if (!user.email) throw new ConvexError({ code: "INVALID", message: "This account has no email address." });
    const sent = await issueReset(ctx, user);
    if (!sent) throw new ConvexError({ code: "RATE_LIMITED", message: "Three links were already sent in the last hour. Try again later." });
    await audit(ctx, { actor: admin, action: "user.reset_link_sent", module: "users", targetTable: "users", targetId: user._id });
  },
});
