"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LocationField, type Place } from "@/components/client/location-field";
import { useQueryState, VendorResults } from "@/components/client/vendor-results";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { formatIsoDate, shortAddress, torontoTodayIso } from "@/lib/format";

/** C-03: find one service near a place, without creating an event (also for visitors, C-01 #6). */
export function ServiceSearch({ profileBase = "/app/vendors", backHref = "/app" }: { profileBase?: string; backHref?: string }) {
  const categories = useQuery(api.catalog.categories);
  const [params, setParams] = useQueryState();
  // Links from the landing page name the service (?service=Photography) rather than its id.
  const service = params.get("service")?.toLowerCase();
  const cat = (params.get("cat") || (categories?.find((c) => c.name.toLowerCase() === service)?._id ?? null)) as Id<"categories"> | null;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const hasSearch = !!cat && params.has("lat") && Number.isFinite(lat) && Number.isFinite(lng);
  const category = categories?.find((c) => c._id === cat);

  if (categories === undefined) return <FullPageLoader />;

  if (!hasSearch || !category) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Find a service" backHref={backHref} />
        <SearchForm
          categories={categories}
          initialCategory={cat}
          onSearch={(s) =>
            setParams({
              cat: s.categoryId,
              lat: s.place.lat.toFixed(5),
              lng: s.place.lng.toFixed(5),
              place: shortAddress(s.place.address),
              date: s.date || null,
            })
          }
        />
      </div>
    );
  }

  const date = params.get("date");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={category.name} eyebrow="Find a service" backHref={backHref} />
      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface-2 px-4 py-3">
        <p className="min-w-0 text-sm">
          <span className="text-ink-2">Near </span>
          <span className="font-semibold">{params.get("place") ?? "your location"}</span>
          {date ? <span className="text-ink-2"> · {formatIsoDate(date, { weekday: false })}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setParams({ lat: null, lng: null, place: null, km: null, min: null, max: null, avail: null, sort: null })}
          className="min-h-11 shrink-0 px-2 text-sm font-semibold text-gold-text"
        >
          Change
        </button>
      </div>
      <VendorResults key={category._id} categoryId={category._id} serviceName={category.name} point={{ lat, lng }} date={date} profileBase={profileBase} />
    </div>
  );
}

function SearchForm({
  categories,
  initialCategory,
  onSearch,
}: {
  categories: { _id: Id<"categories">; name: string }[];
  initialCategory: Id<"categories"> | null;
  onSearch: (s: { categoryId: Id<"categories">; place: Place; date: string }) => void;
}) {
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(initialCategory);
  const [place, setPlace] = useState<Place | null>(null);
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = torontoTodayIso();

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (!categoryId) next.category = "Choose a service.";
        if (!place) next.place = "Pick a place from the suggestions, or use your current location.";
        if (date && date < today) next.date = "The date can't be in the past.";
        setErrors(next);
        if (Object.keys(next).length === 0 && categoryId && place) onSearch({ categoryId, place, date });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-semibold">What do you need?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = c._id === categoryId;
            return (
              <label
                key={c._id}
                className={`press flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${
                  on ? "bg-navy-900 text-white" : "bg-surface text-navy-900 shadow-card"
                }`}
              >
                <input type="radio" name="category" className="sr-only" checked={on} onChange={() => setCategoryId(c._id)} />
                {c.name}
              </label>
            );
          })}
        </div>
        {errors.category ? <p className="text-[13px] font-medium text-danger">{errors.category}</p> : null}
      </fieldset>
      <LocationField id="search-location" label="Where?" value={place} onChange={setPlace} error={errors.place} allowCurrentLocation />
      <TextField id="search-date" label="Date (optional)" type="date" min={today} value={date} error={errors.date} helper="We'll flag vendors who aren't free that day." onChange={(e) => setDate(e.target.value)} />
      <Button type="submit" variant="gold">Show vendors</Button>
    </form>
  );
}
