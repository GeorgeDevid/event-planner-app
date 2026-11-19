import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";

/**
 * Turn an address or postal code into map coordinates (V-02, later C-03/C-04).
 *
 * Uses OpenStreetMap Nominatim, limited to Canada. Its usage policy allows
 * light use (about 1 request per second) with an identifying User-Agent; for
 * production traffic switch to a paid geocoder (Mapbox, Google) by changing
 * only this function.
 */
export const search = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    // Visitors can search too (C-01 #6). Signed-in people get their own
    // allowance; all visitors share one, to protect the free geocoder.
    const identity = await ctx.auth.getUserIdentity();
    const q = query.trim();
    if (q.length < 3 || q.length > 200) return [];
    const ok = await ctx.runMutation(internal.geocode.takeQuota, {
      key: identity ? `user:${identity.subject}` : "guests",
      limit: identity ? 20 : 60,
    });
    if (!ok) {
      throw new ConvexError({ code: "RATE_LIMITED", message: "Too many address lookups right now. Wait a minute and try again." });
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "ca");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("limit", "5");

    const response = await fetch(url, {
      headers: {
        "User-Agent": `EventPlannerApp/0.2 (${process.env.GEOCODER_CONTACT ?? "dev"})`,
        "Accept-Language": "en-CA",
      },
    });
    if (!response.ok) {
      throw new ConvexError({
        code: "GEOCODER_UNAVAILABLE",
        message: "We couldn't look up that address right now. Try again in a moment.",
      });
    }
    const rows = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];
    return rows.map((row) => ({
      label: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }));
  },
});

/** Fixed one-minute windows: true while the key is under its limit. */
export const takeQuota = internalMutation({
  args: { key: v.string(), limit: v.number() },
  handler: async (ctx, { key, limit }) => {
    const now = Date.now();
    const row = await ctx.db.query("geocodeQuota").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row || now - row.windowStart >= 60_000) {
      if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
      else await ctx.db.insert("geocodeQuota", { key, windowStart: now, count: 1 });
      return true;
    }
    if (row.count >= limit) return false;
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return true;
  },
});
