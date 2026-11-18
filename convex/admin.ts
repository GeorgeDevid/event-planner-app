import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { permissionsOf, requireUser } from "./lib/access";
import { torontoToday } from "./lib/dates";

const count = <T>(rows: T[], pick: (row: T) => string) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = pick(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

/**
 * A-02 dashboard. Every admin can open it; each block is only filled in when
 * the admin may view that module (#3).
 */
export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireUser(ctx);
    if (admin.role !== "admin") throw new ConvexError({ code: "FORBIDDEN", message: "You don't have permission to do this." });
    const can = await permissionsOf(ctx, admin);
    const today = torontoToday();

    const users = can.has("users:view")
      ? count((await ctx.db.query("users").collect()).filter((u) => !u.deletedAt), (u) => u.role)
      : null;
    const vendorRows = can.has("vendors:view") ? await ctx.db.query("vendors").collect() : null;
    const events = can.has("events:view")
      ? await ctx.db.query("events").collect()
      : null;
    const inquiries = can.has("events:view") ? await ctx.db.query("inquiries").collect() : null;
    const bookings = can.has("bookings:view") ? await ctx.db.query("bookings").collect() : null;
    const reports = can.has("reports:view") ? await ctx.db.query("reports").collect() : null;

    return {
      users,
      vendorsByStatus: vendorRows ? count(vendorRows, (v) => v.status) : null,
      events: events
        ? {
            total: events.filter((e) => e.status !== "cancelled").length,
            upcoming: events.filter((e) => e.status === "active" && !!e.date && e.date >= today).length,
            byStatus: count(events, (e) => e.status),
          }
        : null,
      inquiriesByStatus: inquiries ? count(inquiries, (i) => i.status) : null,
      bookingsByStatus: bookings ? count(bookings, (b) => b.status) : null,
      todo: {
        pendingVendors: vendorRows && can.has("vendors:approve") ? vendorRows.filter((v) => v.status === "pending").length : null,
        openReports: reports ? reports.filter((r) => r.status !== "resolved").length : null,
        pendingBookings: bookings ? bookings.filter((b) => b.status === "pending").length : null,
      },
    };
  },
});
