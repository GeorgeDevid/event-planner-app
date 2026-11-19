"use client";

import { useAction } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { errorMessage } from "@/lib/errors";

export type Place = { address: string; lat: number; lng: number };

type Suggestion = { placeId?: string; main: string; secondary: string; lat?: number; lng?: number };

const DEBOUNCE_MS = 300;

function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Address box that suggests matching places as the person types (street
 * addresses, buildings, cities and postal codes). Picking one calls onPick with
 * the full address and its map coordinates. Keyboard: arrows move through the
 * list, Enter picks, Escape closes (WAI-ARIA combobox pattern).
 */
export function AddressAutocomplete({
  id,
  label,
  text,
  onTextChange,
  onPick,
  error,
  helper,
  placeholder = "Start typing an address, place or postal code",
}: {
  id: string;
  label: string;
  text: string;
  onTextChange: (text: string) => void;
  onPick: (place: Place) => void;
  error?: string | null;
  helper?: string;
  placeholder?: string;
}) {
  const suggest = useAction(api.places.suggest);
  const details = useAction(api.places.details);
  const search = useAction(api.geocode.search);

  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<"google" | "osm" | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const session = useRef(newSessionToken());
  const requestNo = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function scheduleLookup(value: string) {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 3) {
      requestNo.current++;
      setItems([]);
      setOpen(false);
      setEmpty(false);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const mine = ++requestNo.current;
      setLoading(true);
      try {
        const res = await suggest({ input: q, sessionToken: session.current });
        if (mine !== requestNo.current) return;
        setSource(res.source);
        setItems(res.items);
        setActive(-1);
        setEmpty(res.items.length === 0);
        setOpen(true);
        setLookupError(null);
      } catch (err) {
        if (mine !== requestNo.current) return;
        setItems([]);
        setOpen(false);
        setLookupError(errorMessage(err));
      } finally {
        if (mine === requestNo.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  async function pick(item: Suggestion) {
    setOpen(false);
    setItems([]);
    setLookupError(null);
    const label = [item.main, item.secondary].filter(Boolean).join(", ");
    onTextChange(label);
    try {
      if (item.lat !== undefined && item.lng !== undefined) {
        onPick({ address: label, lat: item.lat, lng: item.lng });
      } else if (item.placeId) {
        setLoading(true);
        const place = await details({ placeId: item.placeId, sessionToken: session.current });
        onTextChange(place.address);
        onPick(place);
      }
    } catch (err) {
      setLookupError(errorMessage(err));
    } finally {
      setLoading(false);
      // A pick ends Google's billing session; the next search starts a new one.
      session.current = newSessionToken();
    }
  }

  /** Enter with nothing suggested: fall back to a plain search of the typed text. */
  async function searchTyped() {
    const q = text.trim();
    if (q.length < 3) {
      setLookupError("Enter a street address, place or postal code.");
      return;
    }
    setLoading(true);
    setLookupError(null);
    try {
      const found = await search({ query: q });
      const asItems = found.map((r) => {
        const [main, ...rest] = r.label.split(",");
        return { main: main.trim(), secondary: rest.join(",").trim(), lat: r.lat, lng: r.lng };
      });
      if (asItems.length === 1) void pick(asItems[0]);
      else if (asItems.length > 1) {
        setItems(asItems);
        setSource("osm");
        setEmpty(false);
        setOpen(true);
      } else {
        setLookupError("We couldn't find that. Check the spelling, or try the street and city.");
      }
    } catch (err) {
      setLookupError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const shownError = lookupError ?? error ?? null;
  const showList = open && (items.length > 0 || empty);
  const describedBy = shownError ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      <div className="relative">
        <svg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            const value = e.target.value;
            onTextChange(value);
            setLookupError(null);
            scheduleLookup(value);
          }}
          onFocus={() => {
            if (items.length > 0) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && items.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % items.length);
            } else if (e.key === "ArrowUp" && items.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (showList && items.length > 0) void pick(items[active >= 0 ? active : 0]);
              else void searchTyped();
            } else if (e.key === "Escape" && showList) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={`h-[52px] w-full rounded-2xl border bg-surface pr-10 pl-11 text-[15px] text-ink placeholder:text-ink-2/80 focus:outline-none focus-visible:outline-3 focus-visible:outline-gold-text ${
            shownError ? "border-danger" : "border-control"
          }`}
        />
        {loading ? (
          <span aria-hidden="true" className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-surface-2 border-t-gold-500 motion-reduce:animate-none" />
        ) : text ? (
          <button
            type="button"
            aria-label="Clear address"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onTextChange("");
              setItems([]);
              setOpen(false);
              setLookupError(null);
              document.getElementById(id)?.focus();
            }}
            className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        ) : null}

        {showList ? (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl bg-surface shadow-float">
            <ul id={listId} role="listbox" aria-label="Suggested addresses" className="max-h-72 overflow-y-auto p-1">
              {items.map((item, i) => (
                <li
                  key={`${item.placeId ?? ""}${item.main}${item.secondary}${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // Keep focus in the box so blur doesn't close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(item)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
                >
                  <svg aria-hidden="true" className="mt-0.5 shrink-0 text-gold-text" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </svg>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-ink">{item.main}</span>
                    {item.secondary ? <span className="text-[13px] text-ink-2">{item.secondary}</span> : null}
                  </span>
                </li>
              ))}
              {empty ? (
                <li role="presentation" className="px-3 py-3 text-sm text-ink-2">
                  No matches yet. Keep typing, or press Enter to search.
                </li>
              ) : null}
            </ul>
            <p className="border-t border-line px-4 py-1.5 text-right text-[11px] text-ink-2">
              {source === "google" ? "Suggestions by Google" : "Map data © OpenStreetMap contributors"}
            </p>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {showList ? (items.length > 0 ? `${items.length} suggestions. Use the arrow keys to choose.` : "No suggestions.") : ""}
      </p>
      {shownError ? (
        <p id={`${id}-error`} className="text-[13px] font-medium text-danger">
          {shownError}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-[13px] text-ink-2">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
