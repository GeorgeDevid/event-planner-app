import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please log in." });
    }
    const q = query.trim();
    if (q.length < 3) return [];

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
