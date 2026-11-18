import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import { notify, postMessage } from "./lib/threads";

const filters = {
  search: v.optional(v.string()),
  status: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
};

/** Names for users and vendors, loaded once per query. */
async function lookups(ctx: QueryCtx) {
  const users = new Map((await ctx.db.query("users").collect()).map((u) => [u._id, u]));
  const vendors = new Map((await ctx.db.query("vendors").collect()).map((x) => [x._id, x]));
  const userLabel = (id: Id<"users">) => {
    const u = users.get(id);
    return { name: u?.name ?? "Deleted user", email: u?.email ?? null };
  };
  const vendorName = (id: Id<"vendors">) => vendors.get(id)?.companyName ?? "Vendor";
  return { userLabel, vendorName };
}

const matches = (term: string | undefined, ...fields: (string | null | undefined)[]) => {
  const t = term?.trim().toLowerCase();
  return !t || fields.some((f) => (f ?? "").toLowerCase().includes(t));
};
const inRange = (date: string | null | undefined, from?: string, to?: string) =>
  (!from || (!!date && date >= from)) && (!to || (!!date && date <= to));
const isoDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

/** A-07 #1: events by client, date range and status. */
export const events = query({
  args: filters,
  handler: async (ctx, f) => {
    await requirePermission(ctx, "events:view");
    const { userLabel } = await lookups(ctx);
    const types = new Map((await ctx.db.query("eventTypes").collect()).map((t) => [t._id, t.name]));
    const bookings = await ctx.db.query("bookings").collect();
    return (await ctx.db.query("events").order("desc").collect())
      .map((e) => {
        const client = userLabel(e.clientId);
        return {
          _id: e._id,
          name: e.name,
          type: types.get(e.eventTypeId) ?? "Event",
          client: client.name,
          clientEmail: client.email,
          date: e.date ?? null,
          location: e.address ?? null,
          guests: e.guestCount ?? null,
          status: e.status,
          services: e.selectedCategoryIds.length,
          booked: bookings.filter((b) => b.eventId === e._id && (b.status === "accepted" || b.status === "completed")).length,
        };
      })
      .filter((e) => (!f.status || e.status === f.status) && inRange(e.date, f.from, f.to) && matches(f.search, e.name, e.client, e.clientEmail))
      .slice(0, 500);
  },
});

/** A-07 #1: inquiries by client or vendor, date sent and status. */
export const inquiries = query({
  args: filters,
  handler: async (ctx, f) => {
    await requirePermission(ctx, "events:view");
    const { userLabel, vendorName } = await lookups(ctx);
    return (await ctx.db.query("inquiries").order("desc").collect())
      .map((i) => ({
        _id: i._id,
        client: userLabel(i.clientId).name,
        vendor: vendorName(i.vendorId),
        service: i.details?.category ?? null,
        eventDate: i.details?.date ?? null,
        sent: isoDay(i.createdAt),
        status: i.status,
      }))
      .filter((i) => (!f.status || i.status === f.status) && inRange(i.sent, f.from, f.to) && matches(f.search, i.client, i.vendor))
      .slice(0, 500);
  },
});

/** A-07 #1: bookings by client or vendor, service date and status. */
export const bookings = query({
  args: filters,
  handler: async (ctx, f) => {
    await requirePermission(ctx, "bookings:view");
    const { userLabel, vendorName } = await lookups(ctx);
    return (await ctx.db.query("bookings").order("desc").collect())
      .map((b) => ({
        _id: b._id,
        inquiryId: b.inquiryId ?? null,
        client: userLabel(b.clientId).name,
        vendor: vendorName(b.vendorId),
        serviceDate: b.serviceDate,
        packageName: b.packageName ?? null,
        priceCents: b.agreedPriceCents ?? null,
        status: b.status,
        reason: b.statusReason ?? null,
      }))
      .filter((b) => (!f.status || b.status === f.status) && inRange(b.serviceDate, f.from, f.to) && matches(f.search, b.client, b.vendor))
      .slice(0, 500);
  },
});

/**
 * A-07 #2-3: an admin cancels a booking (e.g. in a dispute) or marks it
 * completed, with a reason. Both sides are told and it's audited.
 */
export const setBookingStatus = mutation({
  args: {
    bookingId: v.id("bookings"),
    status: v.union(v.literal("cancelled"), v.literal("completed")),
    reason: v.string(),
  },
  handler: async (ctx, { bookingId, status, reason }) => {
    const admin = await requirePermission(ctx, "bookings:edit");
    const booking = (await ctx.db.get(bookingId)) as Doc<"bookings"> | null;
    if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found." });
    const text = reason.trim();
    if (text.length < 5) throw new ConvexError({ code: "INVALID", field: "reason", message: "Give a reason (at least 5 characters)." });
    if (status === "cancelled" && booking.status !== "pending" && booking.status !== "accepted") {
      throw new ConvexError({ code: "INVALID", message: "Only pending or accepted bookings can be cancelled." });
    }
    if (status === "completed" && booking.status !== "accepted") {
      throw new ConvexError({ code: "INVALID", message: "Only accepted bookings can be marked completed." });
    }
    await ctx.db.patch(booking._id, { status, statusReason: `Changed by Event Planner support: ${text}`, updatedAt: Date.now() });
    const vendor = await ctx.db.get(booking.vendorId);
    const inquiry = booking.inquiryId ? await ctx.db.get(booking.inquiryId) : null;
    const verb = status === "cancelled" ? "cancelled" : "marked as completed";
    if (inquiry) await postMessage(ctx, inquiry, { from: "system", body: `Event Planner support ${verb} this booking: ${text}`, bookingId: booking._id });
    await notify(ctx, booking.clientId, {
      title: `Your booking with ${vendor?.companyName ?? "a vendor"} was ${verb}`,
      body: text,
      href: inquiry ? `/app/messages/${inquiry._id}` : undefined,
    });
    if (vendor) {
      await notify(ctx, vendor.ownerId, {
        title: `A booking was ${verb} by Event Planner support`,
        body: text,
        href: inquiry ? `/vendor/inquiries/${inquiry._id}` : "/vendor/inquiries",
      });
    }
    await audit(ctx, {
      actor: admin,
      action: `booking.${status}_by_admin`,
      module: "bookings",
      targetTable: "bookings",
      targetId: booking._id,
      before: { status: booking.status },
      after: { status, reason: text },
    });
  },
});
