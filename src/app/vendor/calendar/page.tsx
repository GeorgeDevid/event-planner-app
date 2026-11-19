"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Card, PageHeader, Switch } from "@/components/ui/kit";
import { errorMessage } from "@/lib/errors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** V-05: block and unblock days; accepted bookings show as booked. */
export default function VendorCalendar() {
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const from = iso(year, month, 1);
  const to = iso(year, month, daysInMonth);

  const data = useQuery(api.vendors.calendar, { from, to });
  const setBlocked = useMutation(api.vendors.setDatesBlocked);
  const setMultiple = useMutation(api.vendors.setMultipleBookingsPerDay);

  const blocked = useMemo(() => new Set(data?.blocked ?? []), [data]);
  const booked = useMemo(() => new Set(data?.booked ?? []), [data]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
  const canGoBack = from.slice(0, 7) > today.slice(0, 7);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected([]);
    setError(null);
  }

  async function apply(block: boolean) {
    setError(null);
    setPending(true);
    try {
      await setBlocked({ dates: selected, blocked: block });
      setSelected([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const selectedBlocked = selected.filter((d) => blocked.has(d)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Availability" backHref="/vendor" />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => shiftMonth(-1)}
            className="press flex size-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <h2 className="text-[17px] font-bold" aria-live="polite">{monthLabel}</h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="press flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="py-1 text-xs font-semibold text-ink-2">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = iso(year, month, i + 1);
            const past = date < today;
            const isBooked = booked.has(date);
            const isBlocked = blocked.has(date);
            const isSelected = selected.includes(date);
            const state = isBooked ? "booked" : isBlocked ? "blocked" : "available";
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                disabled={past}
                aria-selected={isSelected}
                aria-label={`${new Date(year, month, i + 1).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}, ${state}${isSelected ? ", selected" : ""}`}
                onClick={() =>
                  setSelected((s) => (s.includes(date) ? s.filter((x) => x !== date) : [...s, date]))
                }
                className={`relative flex aspect-square min-h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-35 ${
                  isBooked
                    ? "bg-navy-900 text-white"
                    : isBlocked
                      ? "bg-surface-2 text-ink-2 line-through bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(14,26,47,0.08)_5px_7px)]"
                      : "bg-surface text-ink hover:bg-surface-2"
                } ${isSelected ? "ring-3 ring-gold-500 ring-offset-1" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2">
          <li className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded border border-line bg-surface" /> Available</li>
          <li className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded bg-surface-2 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(14,26,47,0.15)_3px_5px)]" /> Blocked</li>
          <li className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded bg-navy-900" /> Booked</li>
        </ul>
      </Card>

      {error ? <FormAlert>{error}</FormAlert> : null}

      {selected.length > 0 ? (
        <div className="sticky bottom-[var(--dock)] z-10 flex flex-col gap-3 rounded-[24px] bg-navy-900 p-4 text-white shadow-float">
          <p className="text-sm" aria-live="polite">
            {selected.length} day{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
            {selectedBlocked > 0 ? (
              <Button type="button" variant="secondary" className="flex-1 border-none" disabled={pending} onClick={() => apply(false)}>
                Unblock
              </Button>
            ) : null}
            {selectedBlocked < selected.length ? (
              <Button type="button" variant="gold" className="flex-1" disabled={pending} onClick={() => apply(true)}>
                Block dates
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-2">
          Tap days to select them, then block or unblock them. Clients filtering by date won&apos;t see
          you on blocked days.
        </p>
      )}

      <Card>
        <Switch
          checked={data?.multipleBookingsPerDay ?? false}
          disabled={data === undefined}
          onChange={(enabled) => setMultiple({ enabled })}
          label="Take more than one booking per day"
          description="When off, a day with an accepted booking is closed to new requests."
        />
      </Card>
    </div>
  );
}
