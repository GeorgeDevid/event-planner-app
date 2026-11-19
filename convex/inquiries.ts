import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireRole, requireUser } from "./lib/access";
import { isIsoDate, torontoToday } from "./lib/dates";
import {
  isOpen,
  loadThread,
  notify,
  postMessage,
  requireParticipant,
  unreadFor,
} from "./lib/threads";
import { checkUpload, IMAGE_TYPES, MAX_IMAGE_BYTES, requireMyVendor } from "./lib/vendorAccess";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

const IMAGE_RULES = { types: ["image/jpeg", "image/png"], maxBytes: MAX_IMAGE_BYTES, label: "JPG or PNG" };
void IMAGE_TYPES;

async function checkImages(ctx: MutationCtx, imageIds: Id<"_storage">[] | undefined) {
  if (!imageIds || imageIds.length === 0) return undefined;
  if (imageIds.length > 4) invalid("Attach up to 4 photos per message.");
  for (const id of imageIds) await checkUpload(ctx, id, IMAGE_RULES);
  return imageIds;
}

// ---------------------------------------------------------------------------
// C-12 send an inquiry
// ---------------------------------------------------------------------------

export const send = mutation({
  args: {
    vendorId: v.id("vendors"),
    eventId: v.optional(v.id("events")),
    categoryId: v.optional(v.id("categories")),
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    guestCount: v.optional(v.number()),
    budgetMinCents: v.optional(v.number()),
    budgetMaxCents: v.optional(v.number()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await requireRole(ctx, "client");
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor || vendor.status !== "approved") invalid("This vendor is no longer available.");
    const message = args.message.trim();
    if (message.length < 1) invalid("Write a message to the vendor.", "message");
    if (message.length > 1000) invalid("Keep the message to 1,000 characters.", "message");
    if (args.date) {
      if (!isIsoDate(args.date)) invalid("Enter a valid date.", "date");
      if (args.date < torontoToday()) invalid("The date can't be in the past.", "date");
    }
    if (args.guestCount !== undefined && (!Number.isInteger(args.guestCount) || args.guestCount < 1)) {
      invalid("Guest count must be a whole number of 1 or more.", "guestCount");
    }
    if (
      args.budgetMinCents !== undefined &&
      args.budgetMaxCents !== undefined &&
      args.budgetMinCents > args.budgetMaxCents
    ) {
      invalid("The budget minimum can't be more than the maximum.", "budgetMin");
    }

    let event: Doc<"events"> | null = null;
    if (args.eventId) {
      event = await ctx.db.get(args.eventId);
      if (!event || event.clientId !== client._id || event.status !== "active") invalid("Choose one of your events.");
    }

    // One open inquiry per vendor per event, or per vendor without an event (C-12 #4).
    const existing = (
      await ctx.db
        .query("inquiries")
        .withIndex("by_event_vendor", (q) => q.eq("eventId", args.eventId).eq("vendorId", vendor._id))
        .collect()
    ).find((i) => i.clientId === client._id && isOpen(i));
    if (existing) {
      throw new ConvexError({
        code: "DUPLICATE",
        message: `You already have an open conversation with ${vendor.companyName}${event ? " for this event" : ""}.`,
        inquiryId: existing._id,
      });
    }

    // The service this inquiry is about: the one asked for, or the first the
    // vendor offers that the event needs.
    let categoryId = args.categoryId;
    if (categoryId && !vendor.categoryIds.includes(categoryId)) invalid("This vendor doesn't offer that service.");
    if (!categoryId) {
      categoryId =
        vendor.categoryIds.find((id) => event?.selectedCategoryIds.includes(id)) ?? vendor.categoryIds[0];
    }
    const category = categoryId ? await ctx.db.get(categoryId) : null;
    const type = event ? await ctx.db.get(event.eventTypeId) : null;

    const inquiryId = await ctx.db.insert("inquiries", {
      clientId: client._id,
      vendorId: vendor._id,
      eventId: event?._id,
      categoryId,
      message,
      details: {
        eventType: type?.name,
        eventName: event?.name,
        category: category?.name,
        date: args.date,
        location: args.location?.trim() || undefined,
        guestCount: args.guestCount,
        budgetMinCents: args.budgetMinCents,
        budgetMaxCents: args.budgetMaxCents,
      },
      status: "sent",
      createdAt: Date.now(),
    });
    const inquiry = (await ctx.db.get(inquiryId))!;
    await postMessage(ctx, inquiry, { senderId: client._id, from: "client", body: message });
    await notify(ctx, vendor.ownerId, {
      title: `New inquiry from ${client.name ?? "a client"}`,
      body: message.slice(0, 140),
      href: `/vendor/inquiries/${inquiryId}`,
    });
    return inquiryId;
  },
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Client's conversations, most recent first (C-13). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const client = await requireRole(ctx, "client");
    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const rows = await Promise.all(
      inquiries.map(async (i) => {
        const vendor = await ctx.db.get(i.vendorId);
        const last = await ctx.db
          .query("messages")
          .withIndex("by_inquiry", (q) => q.eq("inquiryId", i._id))
          .order("desc")
          .first();
        return {
          _id: i._id,
          vendorName: vendor?.companyName ?? "Vendor",
          coverUrl: vendor?.coverImageId ? await ctx.storage.getUrl(vendor.coverImageId) : null,
          eventName: i.details?.eventName ?? null,
          category: i.details?.category ?? null,
          status: i.status,
          lastMessage: last ? preview(last) : i.message,
          lastMessageAt: i.lastMessageAt ?? i.createdAt,
          unread: await unreadFor(ctx, i, "client"),
        };
      }),
    );
    return rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

/** V-06 inbox: inquiries for my business, newest activity first. */
export const forVendor = query({
  args: {},
  handler: async (ctx) => {
    const { vendor } = await requireMyVendor(ctx);
    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    const rows = await Promise.all(
      inquiries.map(async (i) => {
        const client = await ctx.db.get(i.clientId);
        const last = await ctx.db
          .query("messages")
          .withIndex("by_inquiry", (q) => q.eq("inquiryId", i._id))
          .order("desc")
          .first();
        return {
          _id: i._id,
          clientName: client?.name ?? "Client",
          eventType: i.details?.eventType ?? i.details?.category ?? null,
          date: i.details?.date ?? null,
          guestCount: i.details?.guestCount ?? null,
          status: i.status,
          lastMessage: last ? preview(last) : i.message,
          lastMessageAt: i.lastMessageAt ?? i.createdAt,
          unread: await unreadFor(ctx, i, "vendor"),
        };
      }),
    );
    return rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

function preview(m: Doc<"messages">) {
  if (m.removedAt) return "Message removed";
  if (m.quote) return `Quote: $${(m.quote.priceCents / 100).toLocaleString("en-CA")}`;
  if (m.body) return m.body.slice(0, 120);
  if (m.imageIds?.length) return "Photo";
  return "";
}

/** Unread messages across all my conversations, for the nav badge (C-13 #2). */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    let inquiries: Doc<"inquiries">[] = [];
    let side: "client" | "vendor";
    if (user.role === "client") {
      side = "client";
      inquiries = await ctx.db.query("inquiries").withIndex("by_client", (q) => q.eq("clientId", user._id)).collect();
    } else if (user.role === "vendor") {
      side = "vendor";
      const vendor = await ctx.db.query("vendors").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
      if (!vendor) return 0;
      inquiries = await ctx.db.query("inquiries").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect();
    } else {
      return 0;
    }
    let total = 0;
    for (const i of inquiries) total += await unreadFor(ctx, i, side);
    return total;
  },
});

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

export const thread = query({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const { user, inquiry, vendor, role } = await loadThread(ctx, inquiryId);
    const client = await ctx.db.get(inquiry.clientId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiryId))
      .collect();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiryId))
      .collect();
    const packages = (
      await ctx.db.query("packages").withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id)).collect()
    ).filter((p) => p.active);
    const myReport =
      role === "admin"
        ? null
        : (
            await ctx.db
              .query("reports")
              .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiryId))
              .collect()
          ).find((r) => r.reporterId === user._id && r.status !== "resolved") ?? null;

    const otherReadAt =
      role === "client" ? (inquiry.vendorLastReadAt ?? 0) : role === "vendor" ? (inquiry.clientLastReadAt ?? 0) : 0;

    return {
      _id: inquiry._id,
      role,
      status: inquiry.status,
      statusReason: inquiry.statusReason ?? null,
      details: inquiry.details ?? null,
      eventId: role === "client" ? (inquiry.eventId ?? null) : null,
      vendor: { _id: vendor._id, companyName: vendor.companyName, ownerName: vendor.ownerName, available: vendor.status === "approved" },
      client: { name: client?.name ?? "Client" },
      packages: packages.map((p) => ({ _id: p._id, name: p.name, priceCents: p.priceCents, priceType: p.priceType, unit: p.unit })),
      reported: !!myReport,
      messages: await Promise.all(
        messages.map(async (m) => ({
          _id: m._id,
          from: m.from,
          mine: m.from === role,
          body: m.removedAt ? "" : m.body,
          removed: !!m.removedAt,
          quote: m.removedAt ? null : (m.quote ?? null),
          bookingId: m.bookingId ?? null,
          images: m.removedAt
            ? []
            : (await Promise.all((m.imageIds ?? []).map((id) => ctx.storage.getUrl(id)))).filter((u): u is string => !!u),
          createdAt: m.createdAt,
          read: m.from === role ? m.createdAt <= otherReadAt : true,
        })),
      ),
      bookings: (
        await Promise.all(
          bookings.map(async (b) => ({
            b,
            reviewed: !!(await ctx.db.query("reviews").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).first()),
          })),
        )
      )
        .sort((x, y) => y.b.createdAt - x.b.createdAt)
        .map(({ b, reviewed }) => ({
          reviewed,
          _id: b._id,
          serviceDate: b.serviceDate,
          packageName: b.packageName ?? null,
          agreedPriceCents: b.agreedPriceCents ?? null,
          notes: b.notes ?? null,
          status: b.status,
          statusReason: b.statusReason ?? null,
          past: b.serviceDate < torontoToday(),
        })),
    };
  },
});

export const markRead = mutation({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const { role, inquiry } = await loadThread(ctx, inquiryId);
    if (role === "client") await ctx.db.patch(inquiry._id, { clientLastReadAt: Date.now() });
    if (role === "vendor") await ctx.db.patch(inquiry._id, { vendorLastReadAt: Date.now() });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: { inquiryId: v.id("inquiries"), body: v.string(), imageIds: v.optional(v.array(v.id("_storage"))) },
  handler: async (ctx, { inquiryId, body, imageIds }) => {
    const { user, inquiry, vendor, role } = await requireParticipant(ctx, inquiryId);
    if (!isOpen(inquiry) && inquiry.status !== "declined") {
      invalid("This conversation is closed.");
    }
    if (inquiry.status === "declined" && role === "client") invalid("The vendor declined this inquiry.");
    const text = body.trim();
    if (text.length > 2000) invalid("Keep messages to 2,000 characters.");
    const images = await checkImages(ctx, imageIds);
    if (!text && !images) invalid("Write a message or attach a photo.");

    const recipientId = role === "client" ? vendor.ownerId : inquiry.clientId;
    const hadUnread = (await unreadFor(ctx, inquiry, role === "client" ? "vendor" : "client")) > 0;
    await postMessage(ctx, inquiry, { senderId: user._id, from: role, body: text, imageIds: images });
    // One notification per batch of unread messages, not one per message.
    if (!hadUnread) {
      await notify(ctx, recipientId, {
        title: `New message from ${role === "client" ? (user.name ?? "your client") : vendor.companyName}`,
        body: text ? text.slice(0, 140) : "Sent a photo",
        href: role === "client" ? `/vendor/inquiries/${inquiryId}` : `/app/messages/${inquiryId}`,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// V-06 quotes and declining, client closing
// ---------------------------------------------------------------------------

export const sendQuote = mutation({
  args: {
    inquiryId: v.id("inquiries"),
    packageId: v.optional(v.id("packages")),
    priceCents: v.number(),
    notes: v.optional(v.string()),
    validUntil: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, inquiry, vendor } = await requireParticipant(ctx, args.inquiryId, "vendor");
    if (!isOpen(inquiry)) invalid("This inquiry is no longer open.");
    if (!Number.isInteger(args.priceCents) || args.priceCents <= 0) invalid("Enter a price above $0.", "price");
    if (args.priceCents > 100_000_000) invalid("That price looks too high.", "price");
    let packageName: string | undefined;
    if (args.packageId) {
      const pkg = await ctx.db.get(args.packageId);
      if (!pkg || pkg.vendorId !== vendor._id) invalid("Choose one of your packages.", "package");
      packageName = pkg.name;
    }
    if (args.validUntil) {
      if (!isIsoDate(args.validUntil)) invalid("Enter a valid date.", "validUntil");
      if (args.validUntil < torontoToday()) invalid("The quote can't expire in the past.", "validUntil");
    }
    const notes = args.notes?.trim();
    if (notes && notes.length > 1000) invalid("Keep notes to 1,000 characters.", "notes");

    await postMessage(ctx, inquiry, {
      senderId: user._id,
      from: "vendor",
      body: notes ?? "",
      quote: { packageId: args.packageId, packageName, priceCents: args.priceCents, notes: notes || undefined, validUntil: args.validUntil },
    });
    await ctx.db.patch(inquiry._id, { status: "quoted" });
    await notify(ctx, inquiry.clientId, {
      title: `${vendor.companyName} sent you a quote`,
      body: `$${(args.priceCents / 100).toLocaleString("en-CA")}${packageName ? ` · ${packageName}` : ""}`,
      href: `/app/messages/${inquiry._id}`,
    });
  },
});

export const decline = mutation({
  args: { inquiryId: v.id("inquiries"), reason: v.optional(v.string()) },
  handler: async (ctx, { inquiryId, reason }) => {
    const { inquiry, vendor } = await requireParticipant(ctx, inquiryId, "vendor");
    if (!isOpen(inquiry)) invalid("This inquiry is no longer open.");
    const text = reason?.trim() || undefined;
    if (text && text.length > 500) invalid("Keep the reason to 500 characters.");
    await ctx.db.patch(inquiry._id, { status: "declined", statusReason: text });
    await postMessage(ctx, inquiry, {
      from: "system",
      body: `${vendor.companyName} declined this inquiry${text ? `: ${text}` : "."}`,
    });
    await notify(ctx, inquiry.clientId, {
      title: `${vendor.companyName} declined your inquiry`,
      body: text,
      href: `/app/messages/${inquiry._id}`,
    });
  },
});

export const close = mutation({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const { inquiry, vendor, user } = await requireParticipant(ctx, inquiryId, "client");
    if (!isOpen(inquiry)) invalid("This inquiry is already closed.");
    const live = (
      await ctx.db.query("bookings").withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiryId)).collect()
    ).some((b) => b.status === "pending" || b.status === "accepted");
    if (live) invalid("Cancel the booking first, then close the conversation.");
    await ctx.db.patch(inquiry._id, { status: "closed" });
    await postMessage(ctx, inquiry, { from: "system", body: `${user.name ?? "The client"} closed this conversation.` });
    await notify(ctx, vendor.ownerId, {
      title: `${user.name ?? "A client"} closed their inquiry`,
      href: `/vendor/inquiries/${inquiry._id}`,
    });
  },
});
