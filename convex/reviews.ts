import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { audit, getCurrentUser, requirePermission, requireUser } from "./lib/access";
import { torontoToday } from "./lib/dates";
import { notify } from "./lib/threads";

/**
 * Client reviews of vendors. A client can review a vendor once per booking,
 * after the booking is completed or its date has passed. Reviews can be
 * edited or deleted by their author; the vendor can reply; admins with
 * reports:edit can hide one (it then stops counting toward the rating).
 */

const MAX_BODY = 1000;
const MAX_REPLY = 600;

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, field });
}

function notFound(): never {
  throw new ConvexError({ code: "NOT_FOUND", message: "Review not found." });
}

/** "Priya Sharma" -> "Priya S." so reviews don't publish full names. */
function shortName(name: string | undefined | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Client";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function canReview(booking: Doc<"bookings">) {
  return booking.status === "completed" || (booking.status === "accepted" && booking.serviceDate < torontoToday());
}

/** Keep the vendor's rating totals in step with its visible reviews. */
async function recompute(ctx: MutationCtx, vendorId: Id<"vendors">) {
  const rows = await ctx.db.query("reviews").withIndex("by_vendor", (q) => q.eq("vendorId", vendorId)).collect();
  const visible = rows.filter((r) => !r.hidden);
  await ctx.db.patch(vendorId, {
    ratingSum: visible.reduce((s, r) => s + r.rating, 0),
    ratingCount: visible.length,
  });
}

function summary(rows: Doc<"reviews">[]) {
  const visible = rows.filter((r) => !r.hidden);
  const breakdown = [1, 2, 3, 4, 5].map((n) => visible.filter((r) => r.rating === n).length);
  const count = visible.length;
  const average = count ? Math.round((visible.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  return { average, count, breakdown };
}

async function vendorVisible(ctx: QueryCtx, vendorId: Id<"vendors">) {
  const vendor = await ctx.db.get(vendorId);
  if (!vendor) return null;
  const user = await getCurrentUser(ctx);
  if (vendor.status !== "approved" && user?._id !== vendor.ownerId) return null;
  return { vendor, user };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/** Rating summary and the newest visible reviews for a vendor profile. */
export const forVendor = query({
  args: { vendorId: v.id("vendors"), limit: v.optional(v.number()) },
  handler: async (ctx, { vendorId, limit }) => {
    const found = await vendorVisible(ctx, vendorId);
    if (!found) return null;
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendorId))
      .order("desc")
      .collect();
    const visible = rows.filter((r) => !r.hidden);
    const take = Math.min(Math.max(limit ?? 5, 1), 100);
    return {
      ...summary(rows),
      items: await Promise.all(
        visible.slice(0, take).map(async (r) => {
          const client = await ctx.db.get(r.clientId);
          return {
            _id: r._id,
            rating: r.rating,
            body: r.body ?? null,
            author: shortName(client?.name),
            mine: found.user?._id === r.clientId,
            reply: r.reply ?? null,
            repliedAt: r.repliedAt ?? null,
            createdAt: r.createdAt,
            edited: r.updatedAt - r.createdAt > 60_000,
          };
        }),
      ),
      hasMore: visible.length > take,
    };
  },
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** What the signed-in client can do on this vendor: bookings to review, and their own reviews. */
export const forMe = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, { vendorId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.role !== "client") return null;
    const bookings = (
      await ctx.db.query("bookings").withIndex("by_client", (q) => q.eq("clientId", user._id)).collect()
    ).filter((b) => b.vendorId === vendorId);
    const mine = (
      await ctx.db.query("reviews").withIndex("by_client", (q) => q.eq("clientId", user._id)).collect()
    ).filter((r) => r.vendorId === vendorId);
    const reviewed = new Set(mine.map((r) => r.bookingId));
    return {
      toReview: bookings
        .filter((b) => canReview(b) && !reviewed.has(b._id))
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
        .map((b) => ({ bookingId: b._id, serviceDate: b.serviceDate, packageName: b.packageName ?? null })),
      mine: mine
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          _id: r._id,
          bookingId: r.bookingId,
          rating: r.rating,
          body: r.body ?? "",
          hidden: r.hidden,
          hiddenReason: r.hiddenReason ?? null,
          serviceDate: bookings.find((b) => b._id === r.bookingId)?.serviceDate ?? null,
        })),
    };
  },
});

/** Create or update the review for one booking. */
export const submit = mutation({
  args: { bookingId: v.id("bookings"), rating: v.number(), body: v.optional(v.string()) },
  handler: async (ctx, { bookingId, rating, body }) => {
    const user = await requireUser(ctx);
    const booking = await ctx.db.get(bookingId);
    if (!booking || user.role !== "client" || booking.clientId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Booking not found." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) invalid("Pick a rating from 1 to 5 stars.", "rating");
    const text = body?.trim() || undefined;
    if (text && text.length > MAX_BODY) invalid(`Keep your review under ${MAX_BODY} characters.`, "body");

    const existing = await ctx.db.query("reviews").withIndex("by_booking", (q) => q.eq("bookingId", bookingId)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { rating, body: text, updatedAt: now });
      await recompute(ctx, booking.vendorId);
      return existing._id;
    }
    if (!canReview(booking)) invalid("You can review a vendor after the service date of a booking with them.");
    const id = await ctx.db.insert("reviews", {
      vendorId: booking.vendorId,
      clientId: user._id,
      bookingId,
      rating,
      body: text,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    });
    await recompute(ctx, booking.vendorId);
    const vendor = await ctx.db.get(booking.vendorId);
    if (vendor) {
      await notify(ctx, vendor.ownerId, {
        title: `New ${rating}-star review`,
        body: text ? `“${text.length > 140 ? `${text.slice(0, 140)}…` : text}”` : `${shortName(user.name)} rated ${vendor.companyName}.`,
        href: "/vendor/reviews",
      });
    }
    return id;
  },
});

export const remove = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, { reviewId }) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(reviewId);
    if (!review || review.clientId !== user._id) notFound();
    await ctx.db.delete(reviewId);
    await recompute(ctx, review.vendorId);
  },
});

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

async function ownVendor(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const vendor = await ctx.db.query("vendors").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
  if (!vendor || user.role !== "vendor") throw new ConvexError({ code: "FORBIDDEN", message: "Only vendors can do this." });
  return { user, vendor };
}

/** All reviews of my business, newest first, including ones our team hid. */
export const vendorMine = query({
  args: {},
  handler: async (ctx) => {
    const { vendor } = await ownVendor(ctx);
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .order("desc")
      .collect();
    return {
      ...summary(rows),
      items: await Promise.all(
        rows.map(async (r) => {
          const client = await ctx.db.get(r.clientId);
          const booking = await ctx.db.get(r.bookingId);
          return {
            _id: r._id,
            rating: r.rating,
            body: r.body ?? null,
            author: shortName(client?.name),
            serviceDate: booking?.serviceDate ?? null,
            hidden: r.hidden,
            reply: r.reply ?? null,
            createdAt: r.createdAt,
          };
        }),
      ),
    };
  },
});

/** Public reply under a review; an empty reply removes it. */
export const reply = mutation({
  args: { reviewId: v.id("reviews"), text: v.string() },
  handler: async (ctx, { reviewId, text }) => {
    const { vendor } = await ownVendor(ctx);
    const review = await ctx.db.get(reviewId);
    if (!review || review.vendorId !== vendor._id) notFound();
    const t = text.trim();
    if (t.length > MAX_REPLY) invalid(`Keep your reply under ${MAX_REPLY} characters.`, "reply");
    const first = !review.reply && !!t;
    await ctx.db.patch(reviewId, t ? { reply: t, repliedAt: Date.now() } : { reply: undefined, repliedAt: undefined });
    if (first) {
      await notify(ctx, review.clientId, {
        title: `${vendor.companyName} replied to your review`,
        href: `/app/vendors/${vendor._id}`,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export const adminList = query({
  args: { filter: v.union(v.literal("all"), v.literal("hidden"), v.literal("low")) },
  handler: async (ctx, { filter }) => {
    await requirePermission(ctx, "reports:view");
    const rows = await ctx.db.query("reviews").withIndex("by_created").order("desc").take(300);
    const picked = rows.filter((r) => (filter === "hidden" ? r.hidden : filter === "low" ? r.rating <= 2 : true)).slice(0, 100);
    return Promise.all(
      picked.map(async (r) => {
        const client = await ctx.db.get(r.clientId);
        const vendor = await ctx.db.get(r.vendorId);
        return {
          _id: r._id,
          rating: r.rating,
          body: r.body ?? null,
          reply: r.reply ?? null,
          hidden: r.hidden,
          hiddenReason: r.hiddenReason ?? null,
          client: { name: client?.name ?? "Deleted user", email: client?.email ?? null },
          vendor: { _id: r.vendorId, companyName: vendor?.companyName ?? "Deleted vendor" },
          createdAt: r.createdAt,
        };
      }),
    );
  },
});

export const setHidden = mutation({
  args: { reviewId: v.id("reviews"), hidden: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { reviewId, hidden, reason }) => {
    const admin = await requirePermission(ctx, "reports:edit");
    const review = await ctx.db.get(reviewId);
    if (!review) notFound();
    const why = reason?.trim();
    if (hidden && (!why || why.length < 3)) invalid("Give a reason; the client sees it.", "reason");
    await ctx.db.patch(reviewId, { hidden, hiddenReason: hidden ? why : undefined });
    await recompute(ctx, review.vendorId);
    await audit(ctx, {
      actor: admin,
      action: hidden ? "review.hidden" : "review.restored",
      module: "reports",
      targetTable: "reviews",
      targetId: reviewId,
      after: hidden ? { reason: why } : undefined,
    });
    if (hidden) {
      await notify(ctx, review.clientId, {
        title: "Your review was hidden",
        body: `Our team hid your review because: ${why}`,
        href: `/app/vendors/${review.vendorId}`,
      });
    }
  },
});
