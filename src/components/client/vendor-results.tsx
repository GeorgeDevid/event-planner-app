"use client";

import { RatingBadge } from "@/components/ui/stars";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Segmented, Sheet, Switch } from "@/components/ui/kit";
import { formatCents, parseDollars } from "@/lib/format";

type Result = FunctionReturnType<typeof api.vendorSearch.nearby>[number];
type Sort = "nearest" | "top_rated" | "price_asc" | "price_desc" | "newest";
type Km = "5" | "10" | "25" | "50";

const SORT_LABEL: Record<Sort, string> = {
  nearest: "Nearest",
  top_rated: "Top rated",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  newest: "Newest",
};

/** Read and write query-string state, so filters survive a trip to a profile and back (C-08 #7). */
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [params, set] as const;
}

/**
 * Filters and vendor cards for one service near a point (C-03, C-07 to C-09).
 * Budget defaults come from the event; an empty "min" or "max" in the URL
 * means the client cleared it.
 */
export function VendorResults({
  categoryId,
  point,
  date,
  defaultBudget,
  savedIds = [],
  serviceName,
  profileBase = "/app/vendors",
}: {
  categoryId: Id<"categories">;
  point: { lat: number; lng: number };
  date?: string | null;
  defaultBudget?: { min: number | null; max: number | null };
  savedIds?: Id<"vendors">[];
  serviceName: string;
  profileBase?: string;
}) {
  const [params, setParams] = useQueryState();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const km = (["5", "10", "25", "50"].includes(params.get("km") ?? "") ? params.get("km") : "25") as Km;
  const sort = ((params.get("sort") ?? "nearest") in SORT_LABEL ? params.get("sort") ?? "nearest" : "nearest") as Sort;
  const readBudget = (key: "min" | "max", fallback: number | null | undefined) => {
    if (!params.has(key)) return fallback ?? null;
    const raw = params.get(key) ?? "";
    return raw === "" ? null : Number(raw);
  };
  const min = readBudget("min", defaultBudget?.min);
  const max = readBudget("max", defaultBudget?.max);
  const onlyAvailable = date ? params.get("avail") === "1" : false;

  const results = useQuery(api.vendorSearch.nearby, {
    categoryId,
    lat: point.lat,
    lng: point.lng,
    radiusKm: Number(km),
    minPriceCents: min ?? undefined,
    maxPriceCents: max ?? undefined,
    date: date ?? undefined,
    onlyAvailable,
    sort,
  });

  const filtered = params.has("km") || params.has("sort") || params.has("min") || params.has("max") || params.has("avail");
  const budgetLabel =
    min !== null && max !== null
      ? `${formatCents(min)}–${formatCents(max)}`
      : max !== null
        ? `Up to ${formatCents(max)}`
        : min !== null
          ? `From ${formatCents(min)}`
          : "Any budget";

  return (
    <section aria-label={`${serviceName} vendors`} className="flex flex-col gap-4">
      <Segmented
        label="Distance"
        value={km}
        onChange={(v) => setParams({ km: v === "25" ? null : v })}
        options={[
          { value: "5", label: "5 km" },
          { value: "10", label: "10 km" },
          { value: "25", label: "25 km" },
          { value: "50", label: "50 km" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setFiltersOpen(true)}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          {budgetLabel}
          {onlyAvailable ? " · Available" : ""}
        </Button>
        <label className="flex min-h-10 items-center gap-1 rounded-full border border-control bg-surface pr-2 pl-4 text-sm">
          <span className="text-ink-2">Sort</span>
          <select
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value === "nearest" ? null : e.target.value })}
            className="h-full bg-transparent font-semibold focus:outline-none"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite">
          {results === undefined
            ? "Searching…"
            : `${results.length} ${results.length === 1 ? "vendor" : "vendors"} within ${km} km`}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={() => setParams({ km: null, sort: null, min: null, max: null, avail: null })}
            className="min-h-11 px-2 text-sm font-semibold text-gold-text underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {results === undefined ? (
        <ul aria-hidden="true" className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i} className="h-[268px] animate-pulse rounded-[24px] bg-surface-2 motion-reduce:animate-none" />
          ))}
        </ul>
      ) : results.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
          <p className="font-semibold">No {serviceName.toLowerCase()} vendors match</p>
          <p className="mt-1 text-sm text-ink-2">
            Try a wider distance{min !== null || max !== null ? ", a different budget" : ""}
            {onlyAvailable ? " or turn off “Available on my date”" : ""}.
          </p>
          {km !== "50" ? (
            <Button type="button" variant="secondary" className="mt-4" onClick={() => setParams({ km: "50" })}>
              Search within 50 km
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="stagger grid gap-4 md:grid-cols-2">
          {[...results]
            .sort((a, b) => Number(savedIds.includes(b._id)) - Number(savedIds.includes(a._id)))
            .map((r) => (
            <li key={r._id}>
              <VendorCard vendor={r} saved={savedIds.includes(r._id)} href={`${profileBase}/${r._id}`} />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <BudgetFilters
          min={min}
          max={max}
          date={date ?? null}
          onlyAvailable={onlyAvailable}
          onApply={(next) => {
            setParams({
              min: next.min === null ? "" : String(next.min),
              max: next.max === null ? "" : String(next.max),
              avail: next.onlyAvailable ? "1" : null,
            });
            setFiltersOpen(false);
          }}
        />
      </Sheet>
    </section>
  );
}

function BudgetFilters({
  min,
  max,
  date,
  onlyAvailable,
  onApply,
}: {
  min: number | null;
  max: number | null;
  date: string | null;
  onlyAvailable: boolean;
  onApply: (v: { min: number | null; max: number | null; onlyAvailable: boolean }) => void;
}) {
  const [minText, setMinText] = useState(min !== null ? String(min / 100) : "");
  const [maxText, setMaxText] = useState(max !== null ? String(max / 100) : "");
  const [avail, setAvail] = useState(onlyAvailable);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const nextMin = minText.trim() ? parseDollars(minText) : null;
        const nextMax = maxText.trim() ? parseDollars(maxText) : null;
        if ((minText.trim() && nextMin === null) || (maxText.trim() && nextMax === null)) {
          setError("Enter amounts in dollars, like 1500.");
          return;
        }
        if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
          setError("The minimum can't be more than the maximum.");
          return;
        }
        onApply({ min: nextMin, max: nextMax, onlyAvailable: avail });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-semibold">Average price</legend>
        <p className="text-sm text-ink-2">Matches each vendor&apos;s average package price. Leave blank for any.</p>
        <div className="mt-1 flex gap-3">
          <TextField id="budget-min" label="Min (CAD)" inputMode="decimal" className="min-w-0 flex-1" value={minText} onChange={(e) => setMinText(e.target.value)} />
          <TextField id="budget-max" label="Max (CAD)" inputMode="decimal" className="min-w-0 flex-1" value={maxText} onChange={(e) => setMaxText(e.target.value)} />
        </div>
        {error ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}
      </fieldset>
      {date ? (
        <Switch checked={avail} onChange={setAvail} label="Available on my date" description="Hide vendors who are booked or closed that day." />
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => {
            setMinText("");
            setMaxText("");
            setAvail(false);
            setError(null);
          }}
        >
          Reset
        </Button>
        <Button type="submit" className="flex-1">
          Show vendors
        </Button>
      </div>
    </form>
  );
}

/** C-09 vendor card: cover, service type, vendor and company name, average price, distance. */
export function VendorCard({ vendor, saved = false, href }: { vendor: Result; saved?: boolean; href?: string }) {
  return (
    <Link
      href={href ?? `/app/vendors/${vendor._id}`}
      className="press-soft block h-full overflow-hidden rounded-[24px] bg-surface shadow-card"
    >
      <div className="relative h-[160px] bg-dusk">
        {vendor.coverUrl ? <Image src={vendor.coverUrl} alt="" fill sizes="(min-width: 768px) 440px, 100vw" className="object-cover" /> : null}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {vendor.featured ? <span className="rounded-full bg-gold-300 px-2.5 py-1 text-xs font-bold text-navy-900">Featured</span> : null}
          {saved ? <span className="rounded-full bg-navy-900/80 px-2.5 py-1 text-xs font-semibold text-white">Saved</span> : null}
          {vendor.available === false ? (
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-danger">Unavailable on your date</span>
          ) : null}
        </div>
        <span className="absolute right-3 bottom-3 rounded-full bg-navy-900/75 px-2.5 py-1 text-xs font-semibold text-white">
          {vendor.distanceKm} km away
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold-text">{vendor.serviceType}</p>
          <h3 className="truncate text-[17px] font-bold">
            {vendor.companyName}
            {vendor.verified ? <span className="sr-only"> (verified)</span> : null}
          </h3>
          {vendor.ratingCount > 0 ? (
            <RatingBadge average={vendor.ratingAverage} count={vendor.ratingCount} className="mt-0.5" />
          ) : (
            <p className="truncate text-sm text-ink-2">{vendor.ownerName}</p>
          )}
        </div>
        <p className="shrink-0 text-right">
          {vendor.avgPriceCents !== null ? (
            <>
              <span className="block text-xs text-ink-2">Avg.</span>
              <span className="text-[17px] font-bold">{formatCents(vendor.avgPriceCents)}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-ink-2">Price on request</span>
          )}
        </p>
      </div>
    </Link>
  );
}
