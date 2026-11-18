import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/access";

/**
 * A-11: the read-only audit log, newest first, filterable by module, action
 * text, actor and date. There is no mutation that edits or deletes entries.
 */
export const list = query({
  args: {
    module: v.optional(v.string()),
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "auditLog:view");
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const base = args.module
      ? ctx.db.query("auditLog").withIndex("by_module", (q) => q.eq("module", args.module!))
      : ctx.db.query("auditLog").withIndex("by_at");
    const rows = await base.order("desc").take(2000);
    const term = args.action?.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!term || r.action.toLowerCase().includes(term)) &&
        (!args.actorId || r.actorId === args.actorId) &&
        (!args.from || r.at >= args.from) &&
        (!args.to || r.at <= args.to),
    );

    const actorNames = new Map<string, string>();
    for (const r of filtered.slice(0, limit)) {
      if (r.actorId && !actorNames.has(r.actorId)) {
        const actor = await ctx.db.get(r.actorId);
        actorNames.set(r.actorId, actor?.name ?? actor?.email ?? "Unknown");
      }
    }
    // Resolve readable target names for vendors and users.
    const targetNames = new Map<string, string>();
    for (const r of filtered.slice(0, limit)) {
      if (!r.targetId || targetNames.has(r.targetId)) continue;
      if (r.targetTable === "vendors") {
        const id = ctx.db.normalizeId("vendors", r.targetId);
        const vendor = id ? await ctx.db.get(id) : null;
        if (vendor) targetNames.set(r.targetId, vendor.companyName);
      } else if (r.targetTable === "users") {
        const id = ctx.db.normalizeId("users", r.targetId);
        const user = id ? await ctx.db.get(id) : null;
        if (user) targetNames.set(r.targetId, user.name ?? user.email ?? "User");
      } else if (r.targetTable === "categories") {
        const id = ctx.db.normalizeId("categories", r.targetId);
        const category = id ? await ctx.db.get(id) : null;
        if (category) targetNames.set(r.targetId, category.name);
      }
    }

    return {
      total: filtered.length,
      rows: filtered.slice(0, limit).map((r) => ({
        _id: r._id,
        at: r.at,
        actor: r.actorId ? (actorNames.get(r.actorId) ?? "Unknown") : "System",
        actorRole: r.actorRole ?? null,
        action: r.action,
        module: r.module,
        target: r.targetId ? (targetNames.get(r.targetId) ?? r.targetId) : null,
        before: r.before ?? null,
        after: r.after ?? null,
      })),
    };
  },
});
