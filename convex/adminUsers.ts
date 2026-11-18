import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import { revokeAllSessions } from "./lib/sessions";
import { userRole, userStatus } from "./lib/validators";
import { syncVendorLocation } from "./vendorSearch";

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

const PAGE_SIZE = 25;

/**
 * A-03 user list: search by name or email, filter by role, status and signup
 * date, 25 per page, newest first. (Filtering in memory is fine at Phase 0
 * scale; move to a search index past a few thousand users.)
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(userRole),
    status: v.optional(userStatus),
    signedUpAfter: v.optional(v.number()),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "users:view");
    const term = args.search?.trim().toLowerCase();
    let users = await ctx.db.query("users").order("desc").collect();
    users = users.filter(
      (u) =>
        !u.deletedAt &&
        (!args.role || u.role === args.role) &&
        (!args.status || u.status === args.status) &&
        (!args.signedUpAfter || u.createdAt >= args.signedUpAfter) &&
        (!term ||
          (u.name ?? "").toLowerCase().includes(term) ||
          (u.email ?? "").toLowerCase().includes(term)),
    );
    const page = Math.max(1, Math.floor(args.page ?? 1));
    const total = users.length;
    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      rows: users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        role: u.role,
        adminRole: u.adminRole ?? null,
        status: u.status,
        onboarded: u.onboarded,
        createdAt: u.createdAt,
        lastSeenAt: u.lastSeenAt ?? null,
      })),
    };
  },
});

export const detail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requirePermission(ctx, "users:view");
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const vendor = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    const history = (
      await ctx.db
        .query("auditLog")
        .withIndex("by_module", (q) => q.eq("module", "users"))
        .order("desc")
        .take(500)
    )
      .filter((r) => r.targetId === userId)
      .slice(0, 10);
    return {
      ...user,
      vendor: vendor ? { _id: vendor._id, companyName: vendor.companyName, status: vendor.status } : null,
      history: history.map((h) => ({ action: h.action, at: h.at, after: h.after ?? null })),
    };
  },
});

function requireReason(reason: string) {
  const text = reason.trim();
  if (text.length < 5) invalid("Give a reason (at least 5 characters).");
  if (text.length > 1000) invalid("Keep the reason to 1,000 characters.");
  return text;
}

/** A-03: suspend or reactivate. Suspension signs the user out everywhere. */
export const setSuspended = mutation({
  args: { userId: v.id("users"), suspended: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { userId, suspended, reason }) => {
    const admin = await requirePermission(ctx, "users:suspend");
    if (admin._id === userId) invalid("You can't suspend your own account.");
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) invalid("User not found.");
    if (user.adminRole === "super_admin" && admin.adminRole !== "super_admin") {
      invalid("Only a Super Admin can suspend another Super Admin.");
    }
    const text = suspended ? requireReason(reason ?? "") : reason?.trim() || undefined;
    if ((user.status === "suspended") === suspended) return;

    await applySuspension(ctx, admin, user, suspended, text);
  },
});

/** A-03: edit a user's display name. */
export const updateName = mutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, { userId, name }) => {
    const admin = await requirePermission(ctx, "users:edit");
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) invalid("User not found.");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 80) invalid("Enter a name between 2 and 80 characters.");
    await ctx.db.patch(userId, { name: clean });
    await audit(ctx, {
      actor: admin,
      action: "user.renamed",
      module: "users",
      targetTable: "users",
      targetId: userId,
      before: { name: user.name },
      after: { name: clean },
    });
  },
});

/**
 * A-03: delete an account. Personal data is anonymised, the login is removed
 * and sessions are revoked; bookings and other records stay for reporting.
 */
export const remove = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, { userId, reason }) => {
    const admin = await requirePermission(ctx, "users:delete");
    if (admin._id === userId) invalid("You can't delete your own account here.");
    const text = requireReason(reason);
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) invalid("User not found.");
    if (user.adminRole === "super_admin") {
      const supers = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect())
        .filter((u) => u.adminRole === "super_admin" && !u.deletedAt);
      if (supers.length <= 1) invalid("This is the last Super Admin, so it can't be deleted.");
    }

    await revokeAllSessions(ctx, userId);
    await ctx.runMutation(components.authUsername.public.deleteUsername, { userId });
    const vendor = await ctx.db
      .query("vendors")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    if (vendor) {
      await ctx.db.patch(vendor._id, {
        status: "deactivated",
        ownerName: "Deleted user",
        phone: undefined,
      });
      await syncVendorLocation(ctx, vendor._id);
    }
    await ctx.db.patch(userId, {
      name: "Deleted user",
      email: undefined,
      status: "suspended",
      deletedAt: Date.now(),
    });
    await audit(ctx, {
      actor: admin,
      action: "user.deleted",
      module: "users",
      targetTable: "users",
      targetId: userId,
      before: { role: user.role, status: user.status },
      after: { reason: text, anonymised: true },
    });
  },
});

/** Suspend or reactivate a user; shared with moderation (A-03, A-08). */
export async function applySuspension(
  ctx: MutationCtx,
  admin: Doc<"users">,
  user: Doc<"users">,
  suspended: boolean,
  text: string | undefined,
) {
  const userId = user._id;
    await ctx.db.patch(userId, { status: suspended ? "suspended" : "active" });
    let sessionsRevoked = 0;
    if (suspended) {
      sessionsRevoked = await revokeAllSessions(ctx, userId);
      // A suspended vendor's business leaves search too; reactivating the
      // person doesn't relist it automatically (an admin reviews it).
      const vendor = await ctx.db
        .query("vendors")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique();
      if (vendor && (vendor.status === "approved" || vendor.status === "pending")) {
        await ctx.db.patch(vendor._id, { status: "suspended" });
        await syncVendorLocation(ctx, vendor._id);
        await audit(ctx, {
          actor: admin,
          action: "vendor.suspended",
          module: "vendors",
          targetTable: "vendors",
          targetId: vendor._id,
          before: { status: vendor.status },
          after: { status: "suspended", reason: "Owner account suspended" },
        });
      }
    }
    await audit(ctx, {
      actor: admin,
      action: suspended ? "user.suspended" : "user.reactivated",
      module: "users",
      targetTable: "users",
      targetId: userId,
      before: { status: user.status },
      after: { status: suspended ? "suspended" : "active", ...(text ? { reason: text } : {}), sessionsRevoked },
    });
}
