import { ConvexError, v } from "convex/values";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { components } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { issueVerification } from "./emailVerification";
import { audit, getCurrentUser, permissionsOf, requireUser } from "./lib/access";
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

const vGoogleMethod = v.object({ name: v.literal("google"), profile: vGoogleProfile });

/**
 * Convex Auth `createUser` callback for "Continue with Google". A Google
 * account whose verified email matches an existing account with a confirmed
 * email signs in to that account. If the existing account never confirmed its
 * email we refuse, so nobody can pre-register someone else's address and
 * later take over their Google sign-in. Otherwise a new client account is
 * made and goes through onboarding like an email sign-up.
 */
export const createUserGoogle = internalMutation({
  args: { method: vGoogleMethod },
  returns: v.id("users"),
  handler: async (ctx, { method: { profile } }) => {
    const email = profile.email?.trim().toLowerCase();
    const taken = () =>
      new ConvexError({
        code: "ACCOUNT_EXISTS",
        message:
          "An account already uses this email. Log in with your email and password, confirm your email from the link we sent you, then you can use Google too.",
      });
    if (email) {
      // An account can be found by its email, or (before onboarding) only by
      // the email it signed up with as its username.
      const byUsername = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username: email });
      const usernameId = byUsername ? ctx.db.normalizeId("users", byUsername) : null;
      const existing =
        (usernameId ? await ctx.db.get(usernameId) : null) ??
        (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).collect()).find((u) => !u.deletedAt) ??
        null;
      if (existing && !existing.deletedAt) {
        if (profile.emailVerified && existing.emailVerifiedAt) return existing._id;
        throw taken();
      }
    }
    const userId = await ctx.db.insert("users", {
      role: "client",
      status: "active",
      onboarded: false,
      email,
      name: profile.name?.trim().slice(0, 80) || undefined,
      emailVerifiedAt: email && profile.emailVerified ? Date.now() : undefined,
      noPassword: true,
      createdAt: Date.now(),
    });
    // Reserve the email as this account's username, so an email sign-up with
    // the same address is refused ("already uses this email") instead of
    // making a second account, and a password reset can add a password later.
    if (email) {
      const set = await ctx.runMutation(components.authUsername.public.setUsername, { userId, username: email });
      if (!set.success) throw taken();
    }
    return userId;
  },
});

/** Runs on every Google sign-in: blocks suspended accounts and confirms the email Google vouched for. */
export const onSignInGoogle = internalMutation({
  args: { method: vGoogleMethod, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { method: { profile }, userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found." });
    }
    if (user.status === "suspended") {
      throw new ConvexError({
        code: "SUSPENDED",
        message: "This account has been suspended. Contact support if you think this is a mistake.",
      });
    }
    const email = profile.email?.trim().toLowerCase();
    const patch: Partial<typeof user> = { lastSeenAt: Date.now() };
    if (!user.email && email) patch.email = email;
    if (!user.emailVerifiedAt && profile.emailVerified && email && (user.email ?? email) === email) {
      patch.emailVerifiedAt = Date.now();
    }
    await ctx.db.patch(userId, patch);
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
      // False for accounts made with Google that never set a password.
      hasPassword: !user.noPassword,
      vendor: vendor
        ? {
            _id: vendor._id,
            companyName: vendor.companyName,
            status: vendor.status,
          }
        : null,
      permissions: [...(await permissionsOf(ctx, user))],
      emailVerified: !!user.emailVerifiedAt,
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

    // Finishing sign-up accepts the Terms and Privacy Policy in force (A-09).
    const current = async (kind: "terms" | "privacy") =>
      (
        await ctx.db
          .query("legalDocs")
          .withIndex("by_kind_version", (q) => q.eq("kind", kind))
          .order("desc")
          .collect()
      ).find((d) => d.status === "published")?.version;
    await ctx.db.patch(user._id, {
      name,
      email,
      role: args.accountType,
      onboarded: true,
      acceptedTermsVersion: await current("terms"),
      acceptedPrivacyVersion: await current("privacy"),
    });
    const fresh = await ctx.db.get(user._id);
    if (fresh) await issueVerification(ctx, fresh);
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
