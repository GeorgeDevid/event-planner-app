const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/** 240000 → "$2,400" */
export function formatCents(cents: number) {
  return cad.format(cents / 100);
}

/** "2,400" or "2400.50" → 240000 / 240050; null when not a positive amount. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export const UNIT_LABEL = {
  per_event: "per event",
  per_hour: "per hour",
  per_person: "per person",
  per_item: "per item",
} as const;

export function formatPrice(p: {
  priceCents: number;
  priceType: "fixed" | "starting_from";
  unit: keyof typeof UNIT_LABEL;
}) {
  const amount = formatCents(p.priceCents);
  return `${p.priceType === "starting_from" ? "From " : ""}${amount} ${UNIT_LABEL[p.unit]}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "2027-06-12" → "Sat, Jun 12, 2027" (dates are calendar days, no time zone shift). */
export function formatIsoDate(iso: string, opts: { weekday?: boolean } = { weekday: true }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: opts.weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today's date in Toronto as YYYY-MM-DD, for date inputs' min. */
export function torontoTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Budget range label: "$5,000–$15,000", "Up to $8,000", "From $2,000" or null. */
export function formatBudget(min: number | null | undefined, max: number | null | undefined) {
  if (min != null && max != null) return `${formatCents(min)}–${formatCents(max)}`;
  if (max != null) return `Up to ${formatCents(max)}`;
  if (min != null) return `From ${formatCents(min)}`;
  return null;
}

/** First one or two parts of a long geocoded address: "100 City Centre Dr, Mississauga". */
export function shortAddress(address: string) {
  return address.split(",").slice(0, 2).join(",").trim();
}
