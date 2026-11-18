import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import { ALL_PERMISSIONS, APPLICABLE, DEFAULT_MATRIX, defaultPermissions, isPermission, MODULES } from "./lib/permissions";
import { revokeAllSessions } from "./lib/sessions";
import { notify } from "./lib/threads";
import { BUILT_IN_ROLES } from "./lib/validators";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

const BUILT_IN_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
};

type RoleRow = { key: string; name: string; description: string | null; builtIn: boolean; permissions: string[]; locked: boolean };

async function allRoles(ctx: QueryCtx): Promise<RoleRow[]> {
  const rows = await ctx.db.query("roles").collect();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const builtIns: RoleRow[] = BUILT_IN_ROLES.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      name: BUILT_IN_NAMES[key],
      description: row?.description ?? null,
      builtIn: true,
      permissions: key === "super_admin" ? ALL_PERMISSIONS : (row?.permissions ?? defaultPermissions(key)),
      locked: key === "super_admin",
    };
  });
  const custom = rows
    .filter((r) => !r.builtIn)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({ key: r.key, name: r.name, description: r.description ?? null, builtIn: false, permissions: r.permissions, locked: false }));
  return [...builtIns, ...custom];
}

/** A-10: roles, their permissions, and how many admins hold each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "roles:view");
    const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect();
    const roles = await allRoles(ctx);
    return {
      modules: MODULES.map((m) => ({ module: m, actions: APPLICABLE[m] })),
      roles: roles.map((r) => ({
        ...r,
        members: admins.filter((a) => a.adminRole === r.key && !a.deletedAt).length,
      })),
    };
  },
});

/** Role options for the Users drawer. */
export const options = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "users:view");
    return (await allRoles(ctx)).map((r) => ({ key: r.key, name: r.name }));
  },
});

export const savePermissions = mutation({
  args: { key: v.string(), permissions: v.array(v.string()) },
  handler: async (ctx, { key, permissions }) => {
    const admin = await requirePermission(ctx, "roles:edit");
    if (key === "super_admin") invalid("Super Admin always has every permission.");
    const clean = [...new Set(permissions)].filter(isPermission);
    if (clean.length !== new Set(permissions).size) invalid("Unknown permission.");
    const row = await ctx.db.query("roles").withIndex("by_key", (q) => q.eq("key", key)).unique();
    const builtIn = (BUILT_IN_ROLES as readonly string[]).includes(key);
    if (!row && !builtIn) invalid("Role not found.");
    const before = row?.permissions ?? defaultPermissions(key);
    if (row) await ctx.db.patch(row._id, { permissions: clean });
    else await ctx.db.insert("roles", { key, name: BUILT_IN_NAMES[key], builtIn: true, permissions: clean, createdAt: Date.now() });
    await audit(ctx, {
      actor: admin,
      action: "role.permissions_changed",
      module: "roles",
      targetTable: "roles",
      targetId: key,
      before: { added: [], removed: before.filter((p) => !clean.includes(p as never)) },
      after: { added: clean.filter((p) => !before.includes(p)) },
    });
  },
});

export const resetToDefaults = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const admin = await requirePermission(ctx, "roles:edit");
    if (!DEFAULT_MATRIX[key] || key === "super_admin") invalid("Only built-in roles have defaults.");
    const row = await ctx.db.query("roles").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (row) await ctx.db.delete(row._id);
    await audit(ctx, { actor: admin, action: "role.reset_to_defaults", module: "roles", targetTable: "roles", targetId: key });
  },
});

export const create = mutation({
  args: { name: v.string(), copyFrom: v.optional(v.string()) },
  handler: async (ctx, { name, copyFrom }) => {
    const admin = await requirePermission(ctx, "roles:create");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) invalid("Use a name between 2 and 40 characters.", "name");
    const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!key) invalid("Use letters or numbers in the name.", "name");
    const existing = await allRoles(ctx);
    if (existing.some((r) => r.key === key || r.name.toLowerCase() === clean.toLowerCase())) {
      invalid("A role with that name already exists.", "name");
    }
    const source = copyFrom ? existing.find((r) => r.key === copyFrom) : null;
    await ctx.db.insert("roles", {
      key,
      name: clean,
      builtIn: false,
      permissions: source && source.key !== "super_admin" ? source.permissions : [],
      createdAt: Date.now(),
    });
    await audit(ctx, { actor: admin, action: "role.created", module: "roles", targetTable: "roles", targetId: key, after: { name: clean } });
    return key;
  },
});

export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const admin = await requirePermission(ctx, "roles:delete");
    const row = await ctx.db.query("roles").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row || row.builtIn) invalid("Built-in roles can't be deleted.");
    const members = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect()).filter(
      (u) => u.adminRole === key && !u.deletedAt,
    );
    if (members.length > 0) invalid(`${members.length} admin${members.length === 1 ? " has" : "s have"} this role. Move them to another role first.`);
    await ctx.db.delete(row._id);
    await audit(ctx, { actor: admin, action: "role.deleted", module: "roles", targetTable: "roles", targetId: key, before: { name: row.name } });
  },
});

/**
 * A-01 #2, A-10 #3: give a client admin access, change an admin's role, or
 * remove admin access. Only Super Admins can grant or take away Super Admin,
 * and the last Super Admin can't be demoted.
 */
export const setUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, role }) => {
    const admin = await requirePermission(ctx, "roles:edit");
    if (admin._id === userId) invalid("You can't change your own role.");
    const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
    if (!user || user.deletedAt) invalid("User not found.");
    if (user.role === "vendor") invalid("Vendor accounts can't be admins. Use a separate account for admin work.");
    if (role !== null && !(await allRoles(ctx)).some((r) => r.key === role)) invalid("Role not found.");
    const touchesSuper = role === "super_admin" || user.adminRole === "super_admin";
    if (touchesSuper && admin.adminRole !== "super_admin") invalid("Only a Super Admin can grant or remove Super Admin.");
    if (user.adminRole === "super_admin" && role !== "super_admin") {
      const supers = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect()).filter(
        (u) => u.adminRole === "super_admin" && !u.deletedAt && u.status === "active",
      );
      if (supers.length <= 1) invalid("This is the last Super Admin, so the role can't be removed.");
    }
    const before = { role: user.role, adminRole: user.adminRole ?? null };
    if (role === null) {
      if (user.role !== "admin") return;
      await ctx.db.patch(userId, { role: "client", adminRole: undefined });
      // Their admin pages stop working right away; sign them out to be safe.
      await revokeAllSessions(ctx, userId);
    } else {
      await ctx.db.patch(userId, { role: "admin", adminRole: role, onboarded: true });
    }
    await audit(ctx, {
      actor: admin,
      action: role === null ? "user.admin_removed" : before.role === "admin" ? "user.role_changed" : "user.made_admin",
      module: "roles",
      targetTable: "users",
      targetId: userId,
      before,
      after: { role: role === null ? "client" : "admin", adminRole: role },
    });
    await notify(ctx, userId as Id<"users">, {
      title: role === null ? "Your admin access was removed" : "Your admin role was updated",
      body: role === null ? undefined : `You now have the ${BUILT_IN_NAMES[role] ?? role} role.`,
      href: role === null ? undefined : "/admin",
    });
  },
});
