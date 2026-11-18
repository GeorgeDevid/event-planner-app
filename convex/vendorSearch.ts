import { GeospatialIndex } from "@convex-dev/geospatial";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx } from "./_generated/server";

/**
 * Geospatial index of approved vendors, keyed by vendor id and filterable by
 * category (C-03, C-07, C-08). Only approved vendors are in the index, so
 * search never shows pending, suspended or deactivated businesses.
 */
export const vendorLocations = new GeospatialIndex<
  string,
  { categoryId: Id<"categories"> }
>(components.geospatial);

/**
 * Bring a vendor's index entries in line with its record. Call after any change
 * to a vendor's status, location or categories. A vendor with several
 * categories gets one entry per category, keyed `<vendorId>:<categoryId>`, so
 * each can be filtered on its own.
 */
export async function syncVendorLocation(
  ctx: MutationCtx,
  vendorId: Id<"vendors">,
) {
  const vendor = await ctx.db.get(vendorId);
  const keyFor = (categoryId: Id<"categories">) => `${vendorId}:${categoryId}`;

  const allCategories = await ctx.db.query("categories").collect();
  for (const category of allCategories) {
    await vendorLocations.remove(ctx, keyFor(category._id));
  }

  if (!vendor || vendor.status !== "approved" || !vendor.location) return;
  // Deactivated categories are hidden from clients (A-05), so leave them out.
  const activeIds = new Set(allCategories.filter((c) => c.active).map((c) => c._id));
  for (const categoryId of vendor.categoryIds.filter((id) => activeIds.has(id))) {
    await vendorLocations.insert(
      ctx,
      keyFor(categoryId),
      { latitude: vendor.location.lat, longitude: vendor.location.lng },
      { categoryId },
      vendor.avgPriceCents ?? Number.MAX_SAFE_INTEGER,
    );
  }
}

/** Earth distance in km (haversine). */
function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type VendorCard = {
  _id: Id<"vendors">;
  companyName: string;
  ownerName: string;
  serviceType: string;
  avgPriceCents: number | null;
  verified: boolean;
  featured: boolean;
  coverUrl: string | null;
  distanceKm: number;
  available: boolean | null;
  createdAt: number;
};

const SORTS = ["nearest", "price_asc", "price_desc", "newest"] as const;

/**
 * Approved vendors in a category near a point (C-03, C-07, C-08, C-09).
 *
 * - Distance: within `radiusKm` (default 25) of the point, and the point must
 *   be inside the vendor's own service radius unless clients travel to them.
 * - Budget: when a min or max is given, only vendors whose average package
 *   price falls in the range (vendors without prices are left out).
 * - Date: vendors who blocked the date, or already have an accepted booking
 *   that day and take one booking a day, are marked unavailable; with
 *   `onlyAvailable` they are left out.
 * - Sort: nearest (default), price low/high, newest.
 */
export const nearby = query({
  args: {
    categoryId: v.id("categories"),
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),
    minPriceCents: v.optional(v.number()),
    maxPriceCents: v.optional(v.number()),
    date: v.optional(v.string()),
    onlyAvailable: v.optional(v.boolean()),
    sort: v.optional(v.union(...SORTS.map((s) => v.literal(s)))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = Math.min(Math.max(args.radiusKm ?? 25, 1), 200);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const point = { lat: args.lat, lng: args.lng };
    const category = await ctx.db.get(args.categoryId);
    if (!category || !category.active) return [];

    const hits = await vendorLocations.nearest(ctx, {
      point: { latitude: point.lat, longitude: point.lng },
      limit: 200,
      maxDistance: radiusKm * 1000,
      filter: (q) => q.eq("categoryId", args.categoryId),
    });

    const budgetSet = args.minPriceCents !== undefined || args.maxPriceCents !== undefined;
    const results: VendorCard[] = [];
    for (const hit of hits) {
      const vendorId = hit.key.split(":")[0] as Id<"vendors">;
      const vendor = await ctx.db.get(vendorId);
      if (!vendor || vendor.status !== "approved" || !vendor.location) continue;
      const km = distanceKm(point, vendor.location);
      if (!vendor.clientsComeToMe && km > vendor.serviceRadiusKm) continue;

      const avg = vendor.avgPriceCents ?? null;
      if (budgetSet) {
        if (avg === null) continue;
        if (args.minPriceCents !== undefined && avg < args.minPriceCents) continue;
        if (args.maxPriceCents !== undefined && avg > args.maxPriceCents) continue;
      }

      let available: boolean | null = null;
      if (args.date) {
        const blocked = await ctx.db
          .query("blockedDates")
          .withIndex("by_vendor_date", (q) => q.eq("vendorId", vendor._id).eq("date", args.date!))
          .first();
        let booked = false;
        if (!blocked && !vendor.multipleBookingsPerDay) {
          const bookings = await ctx.db
            .query("bookings")
            .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
            .collect();
          booked = bookings.some((b) => b.serviceDate === args.date && b.status === "accepted");
        }
        available = !blocked && !booked;
        if (args.onlyAvailable && !available) continue;
      }

      results.push({
        _id: vendor._id,
        companyName: vendor.companyName,
        ownerName: vendor.ownerName,
        serviceType: category.name,
        avgPriceCents: avg,
        verified: vendor.verified,
        featured: vendor.featured,
        coverUrl: vendor.coverImageId ? await ctx.storage.getUrl(vendor.coverImageId) : null,
        distanceKm: Math.round(km * 10) / 10,
        available,
        createdAt: vendor.createdAt,
      });
    }

    const sort = args.sort ?? "nearest";
    const price = (r: VendorCard, none: number) => r.avgPriceCents ?? none;
    results.sort((a, b) => {
      if (sort === "price_asc") return price(a, Infinity) - price(b, Infinity) || a.distanceKm - b.distanceKm;
      if (sort === "price_desc") return price(b, -Infinity) - price(a, -Infinity) || a.distanceKm - b.distanceKm;
      if (sort === "newest") return b.createdAt - a.createdAt;
      return a.distanceKm - b.distanceKm;
    });
    return results.slice(0, limit);
  },
});
