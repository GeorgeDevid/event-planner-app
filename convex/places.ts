import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";

/**
 * Address suggestions while someone types (C-03, C-04, V-02).
 *
 * With GOOGLE_MAPS_API_KEY set this uses Google Places Autocomplete (New),
 * which knows Canadian postal codes and unit numbers. Without it, it falls
 * back to Photon (free, OpenStreetMap data, light use only), so the feature
 * works before the key is added. The key stays on the server.
 */

const GTA = { lat: 43.6532, lng: -79.3832 };
// Canada's bounding box (west, south, east, north), for the Photon fallback.
const CANADA_BBOX = "-141.01,41.67,-52.62,83.11";
const MAX_SUGGESTIONS = 6;

export type Suggestion = {
  /** Google place id; absent for Photon results, which already carry coordinates. */
  placeId?: string;
  main: string;
  secondary: string;
  lat?: number;
  lng?: number;
};

const sessionToken = v.optional(v.string());

function googleKey() {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

async function checkQuota(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  // One request per pause in typing, so the allowance is wider than "Find".
  const ok = await ctx.runMutation(internal.geocode.takeQuota, {
    key: identity ? `suggest:user:${identity.subject}` : "suggest:guests",
    limit: identity ? 90 : 600,
  });
  if (!ok) {
    throw new ConvexError({ code: "RATE_LIMITED", message: "Too many address lookups right now. Wait a minute and try again." });
  }
}

function unavailable(): never {
  throw new ConvexError({
    code: "GEOCODER_UNAVAILABLE",
    message: "Address suggestions aren't available right now. Keep typing and press Enter to search.",
  });
}

function cleanToken(token: string | undefined) {
  return token && /^[A-Za-z0-9-]{8,64}$/.test(token) ? token : undefined;
}

export const suggest = action({
  args: { input: v.string(), sessionToken },
  handler: async (ctx, { input, sessionToken }): Promise<{ source: "google" | "osm"; items: Suggestion[] }> => {
    const key = googleKey();
    const source = key ? "google" : "osm";
    const q = input.trim();
    if (q.length < 3 || q.length > 200) return { source, items: [] };
    await checkQuota(ctx);
    const items = key ? await googleSuggest(key, q, cleanToken(sessionToken)) : await photonSuggest(q);
    return { source, items };
  },
});

/** Coordinates and full address for a Google suggestion. */
export const details = action({
  args: { placeId: v.string(), sessionToken },
  handler: async (ctx, { placeId, sessionToken }) => {
    if (!/^[A-Za-z0-9_-]{1,300}$/.test(placeId)) {
      throw new ConvexError({ code: "INVALID", message: "That place couldn't be found. Pick another suggestion." });
    }
    const key = googleKey();
    if (!key) unavailable();
    await checkQuota(ctx);
    const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
    const token = cleanToken(sessionToken);
    if (token) url.searchParams.set("sessionToken", token);
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "formattedAddress,location" },
    });
    if (!response.ok) unavailable();
    const place = (await response.json()) as {
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    };
    if (!place.location || !place.formattedAddress) unavailable();
    return { address: place.formattedAddress, lat: place.location.latitude, lng: place.location.longitude };
  },
});

async function googleSuggest(key: string, input: string, token: string | undefined): Promise<Suggestion[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      sessionToken: token,
      includedRegionCodes: ["ca"],
      languageCode: "en",
      locationBias: { circle: { center: { latitude: GTA.lat, longitude: GTA.lng }, radius: 50_000 } },
    }),
  });
  if (!response.ok) unavailable();
  const body = (await response.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (body.suggestions ?? [])
    .flatMap((s) => (s.placePrediction ? [s.placePrediction] : []))
    .slice(0, MAX_SUGGESTIONS)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }))
    .filter((s) => s.main);
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
};

async function photonSuggest(input: string): Promise<Suggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", input);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(GTA.lat));
  url.searchParams.set("lon", String(GTA.lng));
  url.searchParams.set("bbox", CANADA_BBOX);
  const response = await fetch(url, {
    headers: { "User-Agent": `EventPlannerApp/0.2 (${process.env.GEOCODER_CONTACT ?? "dev"})` },
  });
  if (!response.ok) unavailable();
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties;
    if (p.countrycode && p.countrycode.toUpperCase() !== "CA") continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const main = p.name && p.name !== street ? (street ? `${p.name}, ${street}` : p.name) : street || p.city || "";
    if (!main) continue;
    const town = p.city && p.city !== main ? p.city : p.district ?? p.county;
    const secondary = [town, [p.state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const label = `${main}|${secondary}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ main, secondary, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}
