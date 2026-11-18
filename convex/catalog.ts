import { query } from "./_generated/server";

/** Active service categories in display order (C-03, C-06, V-01). */
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categories").withIndex("by_order").collect();
    return rows
      .filter((c) => c.active && !c.parentId)
      .map((c) => ({ _id: c._id, name: c.name, slug: c.slug, icon: c.icon }));
  },
});

/** Active event types with their questions and default services (C-04 to C-06). */
export const eventTypes = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("eventTypes").withIndex("by_order").collect();
    return rows.filter((t) => t.active);
  },
});
