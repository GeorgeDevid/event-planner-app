import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/access";

/** My latest notifications (C-12 #2, C-14 #2, V-07 #1, A-08 #3). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return rows.map((n) => ({
      _id: n._id,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
      read: !!n.readAt,
      createdAt: n.createdAt,
    }));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    return rows.filter((n) => !n.readAt).length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.optional(v.id("notifications")) },
  handler: async (ctx, { notificationId }) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    if (notificationId) {
      const n = await ctx.db.get(notificationId);
      if (n && n.userId === user._id && !n.readAt) await ctx.db.patch(n._id, { readAt: now });
      return;
    }
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
    for (const n of rows) if (!n.readAt) await ctx.db.patch(n._id, { readAt: now });
  },
});
