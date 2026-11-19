import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireUser } from "./lib/access";
import { sendEmail } from "./lib/email";
import { randomToken, sha256 } from "./lib/tokens";

const TTL_MS = 24 * 60 * 60 * 1000;

/** Email a verification link (valid 24 hours, newest only, 3 per hour). */
export async function issueVerification(ctx: MutationCtx, user: Doc<"users">) {
  if (!user.email || user.emailVerifiedAt) return false;
  const now = Date.now();
  const recent = await ctx.db
    .query("emailVerifications")
    .withIndex("by_user", (q) => q.eq("userId", user._id).gt("createdAt", now - 60 * 60 * 1000))
    .collect();
  if (recent.length >= 3) return false;
  for (const r of recent) if (!r.usedAt) await ctx.db.patch(r._id, { usedAt: now });
  const token = randomToken();
  await ctx.db.insert("emailVerifications", { userId: user._id, tokenHash: await sha256(token), expiresAt: now + TTL_MS, createdAt: now });
  await sendEmail(ctx, user.email, {
    subject: "Confirm your email for Event Planner",
    heading: `Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}! Confirm your email`,
    body: "Tap the button to confirm this is your email address, so we can send you updates about your inquiries and bookings. The link works for 24 hours.",
    cta: { label: "Confirm my email", href: `/verify-email?token=${token}` },
    footnote: "If you didn't create an Event Planner account, you can ignore this email.",
  });
  return true;
}

export const resend = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.emailVerifiedAt) return { status: "already_verified" as const };
    const sent = await issueVerification(ctx, user);
    if (!sent) throw new ConvexError({ code: "RATE_LIMITED", message: "We've sent a few links already. Check your inbox and spam folder, or try again in an hour." });
    return { status: "sent" as const };
  },
});

/** Works whether or not the person is logged in on this device. */
export const verify = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const bad = () => new ConvexError({ code: "INVALID_TOKEN", message: "This link has expired or was already used." });
    if (!/^[0-9a-f]{64}$/.test(token)) throw bad();
    const hash = await sha256(token);
    const row = await ctx.db.query("emailVerifications").withIndex("by_token", (q) => q.eq("tokenHash", hash)).unique();
    if (!row) throw bad();
    const user = await ctx.db.get(row.userId);
    if (!user || user.deletedAt) throw bad();
    if (user.emailVerifiedAt) return { status: "already_verified" as const };
    if (row.usedAt || row.expiresAt < Date.now()) throw bad();
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    await ctx.db.patch(user._id, { emailVerifiedAt: Date.now() });
    return { status: "verified" as const };
  },
});
