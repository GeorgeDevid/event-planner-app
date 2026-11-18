import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/access";
import { torontoToday } from "./lib/dates";
import { requireMyVendor } from "./lib/vendorAccess";

const DAY = 86_400_000;

/** Count a profile view: once per viewer per day, never the owner (V-08 #1). */
export const recordView = mutation({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, { vendorId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return;
    const vendor = await ctx.db.get(vendorId);
    if (!vendor || vendor.status !== "approved" || vendor.ownerId === user._id || user.role === "admin") return;
    const day = torontoToday();
    const seen = await ctx.db
      .query("profileViews")
      .withIndex("by_vendor_viewer_day", (q) => q.eq("vendorId", vendorId).eq("viewerKey", user._id).eq("day", day))
      .first();
    if (!seen) await ctx.db.insert("profileViews", { vendorId, viewerKey: user._id, day, at: Date.now() });
  },
});

/** V-08: activity for the last 7 and 30 days, and the next 30 days of bookings. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { vendor } = await requireMyVendor(ctx);
    const now = Date.now();
    const since30 = now - 30 * DAY;
    const since7 = now - 7 * DAY;

    const views = await ctx.db
      .query("profileViews")
      .withIndex("by_vendor_at", (q) => q.eq("vendorId", vendor._id).gt("at", since30))
      .collect();
    const inquiries = await ctx.db.query("inquiries").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect();
    let quotes: number[] = [];
    for (const i of inquiries) {
      if ((i.lastMessageAt ?? i.createdAt) < since30) continue;
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_inquiry", (q) => q.eq("inquiryId", i._id).gt("createdAt", since30))
        .collect();
      quotes = quotes.concat(msgs.filter((m) => m.quote && m.from === "vendor").map((m) => m.createdAt));
    }
    const bookings = await ctx.db.query("bookings").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect();
    const accepted = bookings.filter((b) => b.acceptedAt).map((b) => b.acceptedAt!);

    const window = (times: number[]) => ({
      last7: times.filter((t) => t > since7).length,
      last30: times.filter((t) => t > since30).length,
    });

    const today = torontoToday();
    const in30 = new Date(Date.parse(`${today}T12:00:00Z`) + 30 * DAY).toISOString().slice(0, 10);
    const upcoming = await Promise.all(
      bookings
        .filter((b) => b.status === "accepted" && b.serviceDate >= today && b.serviceDate <= in30)
        .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
        .map(async (b) => ({
          _id: b._id,
          inquiryId: b.inquiryId ?? null,
          serviceDate: b.serviceDate,
          clientName: (await ctx.db.get(b.clientId))?.name ?? "Client",
          packageName: b.packageName ?? null,
        })),
    );

    return {
      views: window(views.map((x) => x.at)),
      inquiries: window(inquiries.map((i) => i.createdAt)),
      quotes: window(quotes),
      bookings: window(accepted),
      upcoming,
    };
  },
});
