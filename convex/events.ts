import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
import { isIsoDate, torontoToday } from "./lib/dates";
import { isOpen, notify, postMessage } from "./lib/threads";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

async function requireMyEvent(ctx: QueryCtx, eventId: Id<"events">) {
  const client = await requireRole(ctx, "client");
  const event = await ctx.db.get(eventId);
  if (!event || event.clientId !== client._id) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Event not found." });
  }
  return { client, event };
}

async function activeCategories(ctx: QueryCtx) {
  return (await ctx.db.query("categories").withIndex("by_order").collect()).filter(
    (c) => c.active && !c.parentId,
  );
}

async function defaultServices(ctx: QueryCtx, type: Doc<"eventTypes">) {
  const active = await activeCategories(ctx);
  return active.filter((c) => type.defaultCategorySlugs.includes(c.slug)).map((c) => c._id);
}

function checkFutureDate(date: string, label: string, field: string) {
  if (!isIsoDate(date)) invalid(`Enter a valid ${label}.`, field);
  if (date < torontoToday()) invalid(`The ${label} can't be in the past.`, field);
}

function checkGuests(n: number, field: string) {
  if (!Number.isInteger(n) || n < 1) invalid("Guest count must be a whole number of 1 or more.", field);
  if (n > 100_000) invalid("That guest count looks too high.", field);
}

// ---------------------------------------------------------------------------
// C-04 basics (creates the draft on first save)
// ---------------------------------------------------------------------------

export const saveBasics = mutation({
  args: {
    eventId: v.optional(v.id("events")),
    eventTypeId: v.id("eventTypes"),
    name: v.optional(v.string()),
    date: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    guestCount: v.number(),
    budgetMinCents: v.optional(v.number()),
    budgetMaxCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const type = await ctx.db.get(args.eventTypeId);
    if (!type || !type.active) invalid("Choose an event type.", "eventTypeId");

    checkFutureDate(args.date, "event date", "date");
    const address = args.address.trim();
    if (address.length < 3) invalid("Enter the event location.", "address");
    if (Math.abs(args.lat) > 90 || Math.abs(args.lng) > 180) invalid("Find the location again.", "address");
    checkGuests(args.guestCount, "guestCount");
    const { budgetMinCents: min, budgetMaxCents: max } = args;
    for (const [value, field] of [[min, "budgetMin"], [max, "budgetMax"]] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) invalid("Enter the budget in dollars.", field);
    }
    if (min !== undefined && max !== undefined && min > max) {
      invalid("The budget minimum can't be more than the maximum.", "budgetMin");
    }
    const name = args.name?.trim() || `My ${type.name.toLowerCase()}`;
    if (name.length > 80) invalid("Keep the event name to 80 characters.", "name");

    const basics = {
      eventTypeId: type._id,
      name,
      date: args.date,
      address,
      location: { lat: args.lat, lng: args.lng },
      guestCount: args.guestCount,
      budgetMinCents: min,
      budgetMaxCents: max,
    };

    if (args.eventId) {
      const { event } = await requireMyEvent(ctx, args.eventId);
      if (event.status === "cancelled") invalid("This event was cancelled.");
      const typeChanged = event.eventTypeId !== type._id;
      await ctx.db.patch(event._id, {
        ...basics,
        // A different event type has different questions and default services.
        ...(typeChanged
          ? { answers: {}, functions: [], selectedCategoryIds: await defaultServices(ctx, type) }
          : {}),
      });
      return event._id;
    }

    return await ctx.db.insert("events", {
      clientId: client._id,
      ...basics,
      answers: {},
      functions: [],
      selectedCategoryIds: await defaultServices(ctx, type),
      shortlistedVendorIds: [],
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// C-05 event-type questions (and wedding functions)
// ---------------------------------------------------------------------------

export const saveDetails = mutation({
  args: {
    eventId: v.id("events"),
    answers: v.record(v.string(), v.any()),
    functions: v.array(
      v.object({
        name: v.string(),
        date: v.optional(v.string()),
        guestCount: v.optional(v.number()),
        venue: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { eventId, answers, functions }) => {
    const { event } = await requireMyEvent(ctx, eventId);
    const type = await ctx.db.get(event.eventTypeId);
    if (!type) invalid("This event type is no longer available.");

    const clean: Record<string, unknown> = {};
    for (const q of type.questions) {
      const raw = answers[q.key];
      const empty =
        raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        if (q.required) invalid(`Answer "${q.label}".`, q.key);
        continue;
      }
      switch (q.type) {
        case "text":
          if (typeof raw !== "string" || raw.trim().length > 200) invalid(`Keep "${q.label}" to 200 characters.`, q.key);
          clean[q.key] = raw.trim();
          break;
        case "number":
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) invalid(`"${q.label}" must be a number.`, q.key);
          clean[q.key] = raw;
          break;
        case "date":
          if (typeof raw !== "string" || !isIsoDate(raw)) invalid(`Enter a valid date for "${q.label}".`, q.key);
          clean[q.key] = raw;
          break;
        case "yes_no":
          if (typeof raw !== "boolean") invalid(`Answer yes or no to "${q.label}".`, q.key);
          clean[q.key] = raw;
          break;
        case "single_choice":
          if (typeof raw !== "string" || !(q.options ?? []).includes(raw)) invalid(`Pick an option for "${q.label}".`, q.key);
          clean[q.key] = raw;
          break;
        case "multi_choice":
          if (!Array.isArray(raw) || raw.some((x) => !(q.options ?? []).includes(x))) {
            invalid(`Pick options for "${q.label}".`, q.key);
          }
          clean[q.key] = [...new Set(raw as string[])];
          break;
      }
    }

    if (type.subFunctions.length === 0 && functions.length > 0) invalid("This event type has no functions.");
    const seen = new Set<string>();
    const cleanFunctions = functions.map((f, i) => {
      if (!type.subFunctions.includes(f.name)) invalid(`"${f.name}" isn't one of the functions.`, `functions.${i}`);
      if (seen.has(f.name) && f.name !== "Other") invalid(`${f.name} is listed twice.`, `functions.${i}`);
      seen.add(f.name);
      if (f.date) checkFutureDate(f.date, `${f.name} date`, `functions.${i}.date`);
      if (f.guestCount !== undefined) checkGuests(f.guestCount, `functions.${i}.guestCount`);
      const venue = f.venue?.trim();
      if (venue && venue.length > 120) invalid("Keep the venue to 120 characters.", `functions.${i}.venue`);
      return { name: f.name, date: f.date || undefined, guestCount: f.guestCount, venue: venue || undefined };
    });
    if (type.subFunctions.length > 0 && cleanFunctions.length === 0) {
      invalid(`Pick at least one ${type.name.toLowerCase()} function.`, "functions");
    }

    await ctx.db.patch(eventId, { answers: clean, functions: cleanFunctions });
  },
});

// ---------------------------------------------------------------------------
// C-06 services checklist; finishing it makes the event active
// ---------------------------------------------------------------------------

export const setServices = mutation({
  args: { eventId: v.id("events"), categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { eventId, categoryIds }) => {
    const { event } = await requireMyEvent(ctx, eventId);
    if (event.status === "cancelled") invalid("This event was cancelled.");
    const unique = [...new Set(categoryIds)];
    if (unique.length === 0) invalid("Choose at least one service.");
    const active = new Set((await activeCategories(ctx)).map((c) => c._id));
    if (unique.some((id) => !active.has(id))) invalid("One of those services is no longer offered.");
    const type = await ctx.db.get(event.eventTypeId);
    if (type && type.subFunctions.length > 0 && event.functions.length === 0) {
      invalid(`Answer the ${type.name.toLowerCase()} questions first.`);
    }
    if (type?.questions.some((q) => q.required && event.answers[q.key] === undefined)) {
      invalid("Answer the event questions first.");
    }
    await ctx.db.patch(eventId, { selectedCategoryIds: unique, status: "active" });
  },
});

// ---------------------------------------------------------------------------
// Reading events
// ---------------------------------------------------------------------------

/** My events, upcoming first, then drafts and past ones (C-15 list). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const client = await requireRole(ctx, "client");
    const events = await ctx.db
      .query("events")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const types = new Map((await ctx.db.query("eventTypes").collect()).map((t) => [t._id, t.name]));
    const today = torontoToday();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const bookedServices = (eventId: Id<"events">) =>
      new Set(
        bookings
          .filter((b) => b.eventId === eventId && (b.status === "accepted" || b.status === "completed"))
          .map((b) => b.categoryId ?? b.vendorId),
      ).size;
    return events
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        bookedCount: bookedServices(e._id),
        _id: e._id,
        name: e.name,
        type: types.get(e.eventTypeId) ?? "Event",
        date: e.date ?? null,
        address: e.address ?? null,
        guestCount: e.guestCount ?? null,
        status: e.status,
        past: !!e.date && e.date < today,
        serviceCount: e.selectedCategoryIds.length,
        shortlistCount: e.shortlistedVendorIds.length,
      }))
      .sort((a, b) => {
        if (a.past !== b.past) return a.past ? 1 : -1;
        return (a.date ?? "9999").localeCompare(b.date ?? "9999");
      });
  },
});

type ServiceStatus = "not_started" | "shortlisted" | "inquiry_sent" | "booking_requested" | "booked";
const RANK: Record<ServiceStatus, number> = {
  not_started: 0,
  shortlisted: 1,
  inquiry_sent: 2,
  booking_requested: 3,
  booked: 4,
};

/** Everything the event dashboard and the setup wizard need (C-04 to C-07). */
export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { event } = await requireMyEvent(ctx, eventId);
    const type = await ctx.db.get(event.eventTypeId);
    const categories = await ctx.db.query("categories").withIndex("by_order").collect();
    const byId = new Map(categories.map((c) => [c._id, c]));

    const shortlisted = (
      await Promise.all(event.shortlistedVendorIds.map((id) => ctx.db.get(id)))
    ).filter((v): v is Doc<"vendors"> => v !== null && v.status === "approved");

    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_event_vendor", (q) => q.eq("eventId", eventId))
      .collect();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // A service's status is the furthest any of its vendors has got (C-07 #3).
    const statusFor = (categoryId: Id<"categories">): ServiceStatus => {
      let best: ServiceStatus = "not_started";
      const bump = (s: ServiceStatus) => {
        if (RANK[s] > RANK[best]) best = s;
      };
      for (const v of shortlisted) if (v.categoryIds.includes(categoryId)) bump("shortlisted");
      for (const i of inquiries) {
        if (i.categoryId === categoryId && (i.status === "sent" || i.status === "quoted")) bump("inquiry_sent");
      }
      for (const b of bookings) {
        if (b.categoryId !== categoryId) continue;
        if (b.status === "accepted" || b.status === "completed") bump("booked");
        else if (b.status === "pending") bump("booking_requested");
      }
      return best;
    };

    return {
      _id: event._id,
      name: event.name,
      status: event.status,
      date: event.date ?? null,
      address: event.address ?? null,
      location: event.location ?? null,
      guestCount: event.guestCount ?? null,
      budgetMinCents: event.budgetMinCents ?? null,
      budgetMaxCents: event.budgetMaxCents ?? null,
      answers: event.answers as Record<string, unknown>,
      functions: event.functions,
      eventType: type
        ? {
            _id: type._id,
            name: type.name,
            questions: type.questions,
            subFunctions: type.subFunctions,
          }
        : null,
      services: event.selectedCategoryIds
        .map((id) => byId.get(id))
        .filter((c): c is Doc<"categories"> => !!c && c.active)
        .map((c) => ({ _id: c._id, name: c.name, slug: c.slug, status: statusFor(c._id) })),
      selectedCategoryIds: event.selectedCategoryIds,
      shortlistedVendorIds: shortlisted.map((v) => v._id),
    };
  },
});

// ---------------------------------------------------------------------------
// Shortlist ("Add to my event", C-10) and cancelling
// ---------------------------------------------------------------------------

/** My open events, marking which ones already include this vendor. */
export const forVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, { vendorId }) => {
    const client = await requireRole(ctx, "client");
    const today = torontoToday();
    const events = await ctx.db
      .query("events")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    return events
      .filter((e) => e.status === "active" && (!e.date || e.date >= today))
      .map((e) => ({
        _id: e._id,
        name: e.name,
        date: e.date ?? null,
        added: e.shortlistedVendorIds.includes(vendorId),
      }));
  },
});

export const setShortlisted = mutation({
  args: { eventId: v.id("events"), vendorId: v.id("vendors"), added: v.boolean() },
  handler: async (ctx, { eventId, vendorId, added }) => {
    const { event } = await requireMyEvent(ctx, eventId);
    if (event.status !== "active") invalid("Finish setting up this event first.");
    const without = event.shortlistedVendorIds.filter((id) => id !== vendorId);
    if (added) {
      const vendor = await ctx.db.get(vendorId);
      if (!vendor || vendor.status !== "approved") invalid("This vendor is no longer available.");
      if (without.length >= 100) invalid("An event can have up to 100 saved vendors.");
      await ctx.db.patch(eventId, { shortlistedVendorIds: [...without, vendorId] });
    } else {
      await ctx.db.patch(eventId, { shortlistedVendorIds: without });
    }
  },
});

/** C-15 #2: copy an event (as a draft) to plan a similar one. */
export const duplicate = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { client, event } = await requireMyEvent(ctx, eventId);
    const name = `${event.name} (copy)`.slice(0, 80);
    const date = event.date && event.date >= torontoToday() ? event.date : undefined;
    return await ctx.db.insert("events", {
      clientId: client._id,
      eventTypeId: event.eventTypeId,
      name,
      date,
      address: event.address,
      location: event.location,
      guestCount: event.guestCount,
      budgetMinCents: event.budgetMinCents,
      budgetMaxCents: event.budgetMaxCents,
      answers: event.answers,
      functions: event.functions.map((f) => ({ ...f, date: f.date && f.date >= torontoToday() ? f.date : undefined })),
      selectedCategoryIds: event.selectedCategoryIds,
      shortlistedVendorIds: [],
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

/**
 * Cancel an event (C-15 #3). Drafts are deleted. For an active event, open
 * bookings are cancelled, open inquiries closed, and each vendor is told.
 */
export const cancel = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const { client, event } = await requireMyEvent(ctx, eventId);
    if (event.status === "draft") {
      await ctx.db.delete(eventId);
      return "deleted" as const;
    }
    if (event.status === "cancelled") return "cancelled" as const;
    const reason = "The client cancelled the event.";
    const told = new Set<string>();
    const bookings = await ctx.db.query("bookings").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    for (const b of bookings) {
      if (b.status !== "pending" && b.status !== "accepted") continue;
      await ctx.db.patch(b._id, { status: "cancelled", statusReason: reason, updatedAt: Date.now() });
    }
    const inquiries = (await ctx.db.query("inquiries").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
      (i) => i.eventId === eventId,
    );
    for (const i of inquiries) {
      const hasLiveBooking = bookings.some((b) => b.inquiryId === i._id && (b.status === "pending" || b.status === "accepted"));
      if (!isOpen(i) && !hasLiveBooking) continue;
      if (isOpen(i)) await ctx.db.patch(i._id, { status: "closed", statusReason: reason });
      await postMessage(ctx, i, { from: "system", body: `${client.name ?? "The client"} cancelled ${event.name}. Any open booking for it was cancelled.` });
      const vendor = await ctx.db.get(i.vendorId);
      if (vendor && !told.has(vendor.ownerId)) {
        told.add(vendor.ownerId);
        await notify(ctx, vendor.ownerId, {
          title: `${client.name ?? "A client"} cancelled their event`,
          body: event.name,
          href: `/vendor/inquiries/${i._id}`,
        });
      }
    }
    await ctx.db.patch(eventId, { status: "cancelled" });
    return "cancelled" as const;
  },
});
