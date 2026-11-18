import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { audit, getCurrentUser, requireUser } from "./lib/access";
import { permissionsFor } from "./lib/permissions";
import { adminRole } from "./lib/validators";

/**
 * Convex Auth `createUser` callback for email + password sign-up (C-01, V-01).
 * New accounts start as clients; onboarding lets them switch to a vendor
 * account. Admin accounts are never created by public sign-up (A-01).
 */
export const createUserPassword = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", {
      role: "client",
      status: "active",
      onboarded: false,
      createdAt: Date.now(),
    });
  },
});

/** Runs on every sign-in: blocks suspended accounts (C-01) and records the visit. */
export const onSignIn = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found." });
    }
    if (user.status === "suspended") {
      throw new ConvexError({
        code: "SUSPENDED",
        message:
          "This account has been suspended. Contact support if you think this is a mistake.",
      });
    }
    // Keep the email in sync with the username the person signed up with.
    if (!user.email) {
      const username = await ctx.runQuery(
        components.authUsername.public.getUsername,
        { userId },
      );
      if (username) await ctx.db.patch(userId, { email: username });
    }
    await ctx.db.patch(userId, { lastSeenAt: Date.now() });
    return null;
  },
});

/** The signed-in user, their vendor business (if any) and admin permissions. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const vendor =
      user.role === "vendor"
        ? await ctx.db
            .query("vendors")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .unique()
        : null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
      adminRole: user.adminRole ?? null,
      onboarded: user.onboarded,
      vendor: vendor
        ? {
            _id: vendor._id,
            companyName: vendor.companyName,
            status: vendor.status,
          }
        : null,
      permissions: permissionsFor(user.adminRole),
    };
  },
});

/**
 * First-run setup after sign-up: the person's name and whether they are
 * planning events (client) or offering services (vendor). A vendor business
 * starts as a draft; the vendor finishes setup and submits it for review, and
 * it stays hidden from search until an admin approves it (V-01).
 */
export const completeOnboarding = mutation({
  args: {
    name: v.string(),
    accountType: v.union(v.literal("client"), v.literal("vendor")),
    companyName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.onboarded) {
      throw new ConvexError({
        code: "ALREADY_ONBOARDED",
        message: "Your account is already set up.",
      });
    }
    const name = args.name.trim();
    if (name.length < 2) {
      throw new ConvexError({ code: "INVALID", message: "Enter your name." });
    }

    if (args.accountType === "vendor") {
      const companyName = args.companyName?.trim() ?? "";
      if (companyName.length < 2) {
        throw new ConvexError({
          code: "INVALID",
          message: "Enter your company name.",
        });
      }
      await ctx.db.insert("vendors", {
        ownerId: user._id,
        companyName,
        ownerName: name,
        phone: args.phone?.trim() || undefined,
        categoryIds: [],
        serviceRadiusKm: 25,
        clientsComeToMe: false,
        // Draft until the vendor finishes setup and submits it for review.
        status: "draft",
        verified: false,
        featured: false,
        createdAt: Date.now(),
      });
    }

    // At sign-up the username (email) is stored after the user record is
    // created, so pick it up here if onSignIn couldn't.
    const email =
      user.email ??
      (await ctx.runQuery(components.authUsername.public.getUsername, {
        userId: user._id,
      })) ??
      undefined;

    await ctx.db.patch(user._id, {
      name,
      email,
      role: args.accountType,
      onboarded: true,
    });
    return { role: args.accountType };
  },
});

/**
 * Make an existing account an admin. Run it once from the Convex dashboard or
 * CLI to create the first Super Admin, e.g.
 * `npx convex run users:grantAdminRole '{"email":"you@example.com","adminRole":"super_admin"}'`.
 * After that, admins are managed in the admin portal (A-10).
 */
export const grantAdminRole = internalMutation({
  args: { email: v.string(), adminRole },
  handler: async (ctx, { email, adminRole: role }) => {
    const normalized = email.trim().toLowerCase();
    const userId = await ctx.runQuery(
      components.authUsername.public.getUserIdByUsername,
      { username: normalized },
    );
    if (!userId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: `No account uses ${normalized}. Sign up first, then run this again.`,
      });
    }
    const user = await ctx.db.normalizeId("users", userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "Account not found." });
    const before = await ctx.db.get(user);
    await ctx.db.patch(user, {
      role: "admin",
      adminRole: role,
      email: normalized,
      name: before?.name ?? normalized,
      onboarded: true,
    });
    await audit(ctx, {
      actor: null,
      action: "admin.grant_role",
      module: "roles",
      targetTable: "users",
      targetId: user,
      before: { role: before?.role, adminRole: before?.adminRole },
      after: { role: "admin", adminRole: role },
    });
    return null;
  },
});

/**
 * Operator-only password recovery, until email reset ships (A-03).
 * Internal: it can't be called from the app, only with the deploy key, e.g.
 * `npx convex run users:operatorResetPassword '{"email":"…","password":"…"}'`
 * or from Functions in the Convex dashboard. Signs the user out everywhere.
 */
export const operatorResetPassword = internalMutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const normalized = email.trim().toLowerCase();
    const userId = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, {
      username: normalized,
    });
    const id = userId ? ctx.db.normalizeId("users", userId) : null;
    if (!id) throw new ConvexError({ code: "NOT_FOUND", message: `No account uses ${normalized}.` });
    const result = await ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
      userId: id,
      password,
      minimumLength: 10,
    });
    if (!result.success) {
      throw new ConvexError({ code: "INVALID", message: `Password rejected: ${result.userError.error}` });
    }
    const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId: id });
    if (sessions.length > 0) {
      await ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: sessions.map((s) => s.sessionId),
      });
    }
    await audit(ctx, {
      actor: null,
      action: "user.password_reset_by_operator",
      module: "users",
      targetTable: "users",
      targetId: id,
      after: { sessionsRevoked: sessions.length },
    });
    return { ok: true, sessionsRevoked: sessions.length };
  },
});
