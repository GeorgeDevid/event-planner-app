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
