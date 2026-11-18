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

/**
 * Approved vendors in a category within `radiusKm` of a point, nearest first
 * (C-08 distance filter, default 25 km). A vendor is only included when the
 * client is also inside the vendor's own service radius, unless clients
 * travel to the vendor (salons, spas).
 */
export const nearby = query({
  args: {
    categoryId: v.id("categories"),
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = Math.min(Math.max(args.radiusKm ?? 25, 1), 200);
    const limit = Math.min(args.limit ?? 50, 100);
    const point = { lat: args.lat, lng: args.lng };

    const hits = await vendorLocations.nearest(ctx, {
      point: { latitude: point.lat, longitude: point.lng },
      limit,
      maxDistance: radiusKm * 1000,
      filter: (q) => q.eq("categoryId", args.categoryId),
    });

    const results = [];
    for (const hit of hits) {
      const vendorId = hit.key.split(":")[0] as Id<"vendors">;
      const vendor = await ctx.db.get(vendorId);
      if (!vendor || vendor.status !== "approved" || !vendor.location) continue;
      const km = distanceKm(point, vendor.location);
      if (!vendor.clientsComeToMe && km > vendor.serviceRadiusKm) continue;
      results.push({
        _id: vendor._id,
        companyName: vendor.companyName,
        ownerName: vendor.ownerName,
        avgPriceCents: vendor.avgPriceCents ?? null,
        verified: vendor.verified,
        featured: vendor.featured,
        distanceKm: Math.round(km * 10) / 10,
      });
    }
    return results;
  },
});
