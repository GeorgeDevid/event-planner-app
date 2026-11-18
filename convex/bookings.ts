import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { audit, requireRole, requireUser, userCan } from "./lib/access";
import { isIsoDate, torontoToday } from "./lib/dates";
import { isOpen, notify, postMessage } from "./lib/threads";
import { requireMyVendor } from "./lib/vendorAccess";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-CA")}`;
const niceDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Is the vendor free that day? (blocked days, or a day already booked). */
async function conflict(ctx: MutationCtx, vendor: Doc<"vendors">, date: string, ignore?: Id<"bookings">) {
  const blocked = await ctx.db
    .query("blockedDates")
    .withIndex("by_vendor_date", (q) => q.eq("vendorId", vendor._id).eq("date", date))
    .first();
  if (blocked) return "blocked" as const;
  if (vendor.multipleBookingsPerDay) return null;
  const taken = (
    await ctx.db.query("bookings").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect()
  ).some((b) => b._id !== ignore && b.serviceDate === date && b.status === "accepted");
  return taken ? ("booked" as const) : null;
}

async function loadBooking(ctx: MutationCtx, bookingId: Id<"bookings">) {
  const booking = await ctx.db.get(bookingId);
  if (!booking) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found." });
  const vendor = (await ctx.db.get(booking.vendorId))!;
  const inquiry = booking.inquiryId ? await ctx.db.get(booking.inquiryId) : null;
  return { booking, vendor, inquiry };
}

// ---------------------------------------------------------------------------
// C-14 request a booking
// ---------------------------------------------------------------------------

export const request = mutation({
  args: {
    vendorId: v.id("vendors"),
    eventId: v.optional(v.id("events")),
    serviceDate: v.string(),
    packageId: v.optional(v.id("packages")),
    agreedPriceCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor || vendor.status !== "approved") invalid("This vendor is no longer available.");
    if (!isIsoDate(args.serviceDate)) invalid("Choose the service date.", "serviceDate");
    if (args.serviceDate < torontoToday()) invalid("The service date can't be in the past.", "serviceDate");
    let event: Doc<"events"> | null = null;
    if (args.eventId) {
      event = await ctx.db.get(args.eventId);
      if (!event || event.clientId !== client._id || event.status !== "active") invalid("Choose one of your events.", "eventId");
    }
    let pkg: Doc<"packages"> | null = null;
    if (args.packageId) {
      pkg = await ctx.db.get(args.packageId);
      if (!pkg || pkg.vendorId !== vendor._id || !pkg.active) invalid("Choose one of this vendor's packages.", "packageId");
    }
    if (args.agreedPriceCents !== undefined && (!Number.isInteger(args.agreedPriceCents) || args.agreedPriceCents <= 0)) {
      invalid("Enter the agreed price in dollars.", "agreedPrice");
    }
    const notes = args.notes?.trim() || undefined;
    if (notes && notes.length > 1000) invalid("Keep notes to 1,000 characters.", "notes");

    const clash = await conflict(ctx, vendor, args.serviceDate);
    if (clash) invalid(`${vendor.companyName} isn't available on that date. Try another day.`, "serviceDate");

    const mine = await ctx.db.query("bookings").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect();
    const duplicate = mine.find(
      (b) =>
        b.vendorId === vendor._id &&
        (b.status === "pending" || b.status === "accepted") &&
        (event ? b.eventId === event._id : b.serviceDate === args.serviceDate),
    );
    if (duplicate) invalid(`You already have a ${duplicate.status} booking with ${vendor.companyName}${event ? " for this event" : " on that date"}.`);

    // Keep everything in one conversation: reuse the open inquiry, or start one.
    let inquiry = (
      await ctx.db
        .query("inquiries")
        .withIndex("by_event_vendor", (q) => q.eq("eventId", event?._id).eq("vendorId", vendor._id))
        .collect()
    ).find((i) => i.clientId === client._id && isOpen(i));
    if (!inquiry) {
      const type = event ? await ctx.db.get(event.eventTypeId) : null;
      const categoryId =
        vendor.categoryIds.find((id) => event?.selectedCategoryIds.includes(id)) ?? vendor.categoryIds[0];
      const category = categoryId ? await ctx.db.get(categoryId) : null;
      const id = await ctx.db.insert("inquiries", {
        clientId: client._id,
        vendorId: vendor._id,
        eventId: event?._id,
        categoryId,
        message: notes ?? "Booking request",
        details: {
          eventType: type?.name,
          eventName: event?.name,
          category: category?.name,
          date: args.serviceDate,
          location: event?.address,
          guestCount: event?.guestCount,
          budgetMinCents: event?.budgetMinCents,
          budgetMaxCents: event?.budgetMaxCents,
        },
        status: "sent",
        createdAt: Date.now(),
      });
      inquiry = (await ctx.db.get(id))!;
    }

    const bookingId = await ctx.db.insert("bookings", {
      clientId: client._id,
      vendorId: vendor._id,
      eventId: event?._id,
      inquiryId: inquiry._id,
      categoryId: inquiry.categoryId,
      serviceDate: args.serviceDate,
      packageId: pkg?._id,
      packageName: pkg?.name,
      agreedPriceCents: args.agreedPriceCents,
      notes,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const summary = [niceDate(args.serviceDate), pkg?.name, args.agreedPriceCents ? money(args.agreedPriceCents) : null]
      .filter(Boolean)
      .join(" · ");
    await postMessage(ctx, inquiry, {
      senderId: client._id,
      from: "system",
      body: `${client.name ?? "The client"} requested a booking: ${summary}${notes ? `. Notes: ${notes}` : ""}`,
      bookingId,
    });
    await notify(ctx, vendor.ownerId, {
      title: `Booking request from ${client.name ?? "a client"}`,
      body: summary,
      href: `/vendor/inquiries/${inquiry._id}`,
    });
    return { bookingId, inquiryId: inquiry._id };
  },
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const client = await requireRole(ctx, "client");
    const rows = await ctx.db.query("bookings").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect();
    return Promise.all(
      rows
        .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
        .map(async (b) => ({
          _id: b._id,
          inquiryId: b.inquiryId ?? null,
          vendorName: (await ctx.db.get(b.vendorId))?.companyName ?? "Vendor",
          eventName: b.eventId ? ((await ctx.db.get(b.eventId))?.name ?? null) : null,
          serviceDate: b.serviceDate,
          status: b.status,
          packageName: b.packageName ?? null,
          agreedPriceCents: b.agreedPriceCents ?? null,
        })),
    );
  },
});

/** V-07 booking requests for my business. */
export const forVendor = query({
  args: {},
  handler: async (ctx) => {
    const { vendor } = await requireMyVendor(ctx);
    const rows = await ctx.db.query("bookings").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect();
    const today = torontoToday();
    return Promise.all(
      rows
        .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
        .map(async (b) => {
          const inquiry = b.inquiryId ? await ctx.db.get(b.inquiryId) : null;
          return {
            _id: b._id,
            inquiryId: b.inquiryId ?? null,
            clientName: (await ctx.db.get(b.clientId))?.name ?? "Client",
            eventType: inquiry?.details?.eventType ?? inquiry?.details?.category ?? null,
            guestCount: inquiry?.details?.guestCount ?? null,
            serviceDate: b.serviceDate,
            status: b.status,
            past: b.serviceDate < today,
            packageName: b.packageName ?? null,
            agreedPriceCents: b.agreedPriceCents ?? null,
          };
        }),
    );
  },
});

// ---------------------------------------------------------------------------
// V-07 vendor actions
// ---------------------------------------------------------------------------

async function vendorBooking(ctx: MutationCtx, bookingId: Id<"bookings">) {
  const { user, vendor: mine } = await requireMyVendor(ctx);
  const loaded = await loadBooking(ctx, bookingId);
  if (loaded.booking.vendorId !== mine._id) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found." });
  return { user, ...loaded };
}

async function record(
  ctx: MutationCtx,
  inquiry: Doc<"inquiries"> | null,
  bookingId: Id<"bookings">,
  body: string,
) {
  if (inquiry) await postMessage(ctx, inquiry, { from: "system", body, bookingId });
}

export const respond = mutation({
  args: { bookingId: v.id("bookings"), accept: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { bookingId, accept, reason }) => {
    const { booking, vendor, inquiry } = await vendorBooking(ctx, bookingId);
    if (booking.status !== "pending") invalid("This request was already answered.");
    if (vendor.status !== "approved") invalid("Your business isn't active, so it can't take bookings.");
    const href = inquiry ? `/app/messages/${inquiry._id}` : "/app/events";
    if (accept) {
      const clash = await conflict(ctx, vendor, booking.serviceDate, booking._id);
      if (clash === "blocked") invalid("That day is blocked on your calendar. Unblock it first, or decline.");
      if (clash === "booked") invalid("You already have a booking that day. Turn on more than one booking per day in your calendar, or decline.");
      await ctx.db.patch(booking._id, { status: "accepted", updatedAt: Date.now() });
      await record(ctx, inquiry, booking._id, `${vendor.companyName} accepted the booking for ${niceDate(booking.serviceDate)}.`);
      await notify(ctx, booking.clientId, { title: `${vendor.companyName} accepted your booking`, body: niceDate(booking.serviceDate), href });
    } else {
      const text = reason?.trim() ?? "";
      if (text.length < 3) invalid("Give the client a short reason.", "reason");
      if (text.length > 500) invalid("Keep the reason to 500 characters.", "reason");
      await ctx.db.patch(booking._id, { status: "declined", statusReason: text, updatedAt: Date.now() });
      await record(ctx, inquiry, booking._id, `${vendor.companyName} declined the booking: ${text}`);
      await notify(ctx, booking.clientId, { title: `${vendor.companyName} declined your booking`, body: text, href });
    }
  },
});

export const complete = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const { booking, vendor, inquiry } = await vendorBooking(ctx, bookingId);
    if (booking.status !== "accepted") invalid("Only accepted bookings can be completed.");
    if (booking.serviceDate > torontoToday()) invalid("You can mark it completed after the service date.");
    await ctx.db.patch(booking._id, { status: "completed", updatedAt: Date.now() });
    await record(ctx, inquiry, booking._id, `${vendor.companyName} marked the booking as completed.`);
    await notify(ctx, booking.clientId, {
      title: `Booking with ${vendor.companyName} completed`,
      href: inquiry ? `/app/messages/${inquiry._id}` : undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// Cancelling (client: pending or accepted; vendor: accepted, admins told)
// ---------------------------------------------------------------------------

export const cancel = mutation({
  args: { bookingId: v.id("bookings"), reason: v.string() },
  handler: async (ctx, { bookingId, reason }) => {
    const user = await requireUser(ctx);
    const { booking, vendor, inquiry } = await loadBooking(ctx, bookingId);
    const asClient = user.role === "client" && booking.clientId === user._id;
    const asVendor = user.role === "vendor" && vendor.ownerId === user._id;
    if (!asClient && !asVendor) throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found." });
    if (asClient && booking.status !== "pending" && booking.status !== "accepted") {
      invalid("Only pending or accepted bookings can be cancelled.");
    }
    if (asVendor && booking.status !== "accepted") {
      invalid(booking.status === "pending" ? "Decline the request instead." : "Only accepted bookings can be cancelled.");
    }
    const text = reason.trim();
    if (text.length < 3) invalid("Give a short reason.", "reason");
    if (text.length > 500) invalid("Keep the reason to 500 characters.", "reason");

    await ctx.db.patch(booking._id, { status: "cancelled", statusReason: text, updatedAt: Date.now() });
    const who = asClient ? (user.name ?? "The client") : vendor.companyName;
    await record(ctx, inquiry, booking._id, `${who} cancelled the booking for ${niceDate(booking.serviceDate)}: ${text}`);
    if (asClient) {
      await notify(ctx, vendor.ownerId, {
        title: `${user.name ?? "A client"} cancelled a booking`,
        body: `${niceDate(booking.serviceDate)} · ${text}`,
        href: inquiry ? `/vendor/inquiries/${inquiry._id}` : "/vendor/bookings",
      });
    } else {
      await notify(ctx, booking.clientId, {
        title: `${vendor.companyName} cancelled your booking`,
        body: `${niceDate(booking.serviceDate)} · ${text}`,
        href: inquiry ? `/app/messages/${inquiry._id}` : undefined,
      });
      // V-07 #4: admins hear about vendor cancellations.
      const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect();
      for (const a of admins) {
        if (a.status === "active" && !a.deletedAt && (await userCan(ctx, a, "bookings:edit"))) {
          await notify(ctx, a._id, {
            title: `${vendor.companyName} cancelled an accepted booking`,
            body: `${niceDate(booking.serviceDate)} · ${text}`,
          });
        }
      }
      await audit(ctx, {
        actor: user,
        action: "booking.cancelled_by_vendor",
        module: "bookings",
        targetTable: "bookings",
        targetId: booking._id,
        before: { status: booking.status },
        after: { status: "cancelled", reason: text },
      });
    }
  },
});
