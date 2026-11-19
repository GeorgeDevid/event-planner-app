"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";
import { shortAddress } from "@/lib/format";

export type Place = { address: string; lat: number; lng: number };

// Canadian postal codes (full or first three characters).
const POSTAL_CODE = /^[A-Za-z]\d[A-Za-z][ -]?(\d[A-Za-z]\d)?$/;

/**
 * Street address or city lookup, with an optional "Use my current location"
 * button (C-03 #1-2, C-04 #5). Calls onChange with the found place, or null
 * while the text no longer matches a found place.
 */
export function LocationField({
  id,
  label,
  value,
  onChange,
  error,
  allowCurrentLocation = false,
  helper,
}: {
  id: string;
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  error?: string | null;
  allowCurrentLocation?: boolean;
  helper?: string;
}) {
  const geocode = useAction(api.geocode.search);
  const [text, setText] = useState(value?.address ?? "");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"search" | "gps" | null>(null);

  async function find() {
    setLookupError(null);
    setResults(null);
    if (text.trim().length < 3) {
      setLookupError("Enter a street address or city.");
      return;
    }
    setBusy("search");
    try {
      const found = await geocode({ query: text });
      if (found.length === 0) {
        setLookupError(
          POSTAL_CODE.test(text.trim())
            ? "Postal codes can't be looked up yet. Enter a street address or city instead."
            : "We couldn't find that. Check the spelling, or try the street and city.",
        );
      }
      else if (found.length === 1) choose(found[0]);
      else setResults(found);
    } catch (err) {
      setLookupError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function choose(r: { label: string; lat: number; lng: number }) {
    setResults(null);
    setText(shortAddress(r.label));
    onChange({ address: r.label, lat: r.lat, lng: r.lng });
  }

  function useCurrentLocation() {
    setLookupError(null);
    if (!("geolocation" in navigator)) {
      setLookupError("Location isn't available on this device. Enter a street address or city instead.");
      return;
    }
    setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        setText("Current location");
        onChange({ address: "Current location", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy(null);
        setLookupError("We couldn't get your location. Enter a street address or city instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const shownError = lookupError ?? error ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <TextField
          id={id}
          label={label}
          className="flex-1"
          autoComplete="street-address"
          value={text}
          error={shownError}
          helper={value ? `Found: ${shortAddress(value.address)}` : helper}
          onChange={(e) => {
            setText(e.target.value);
            setResults(null);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void find();
            }
          }}
        />
        {/* Spacer the height of the field label keeps the button level with the input, even when a note or error shows below it. */}
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="text-xs font-semibold invisible">.</span>
          <Button type="button" variant="secondary" className="h-[52px]" onClick={find} disabled={busy !== null}>
            {busy === "search" ? "Finding…" : "Find"}
          </Button>
        </div>
      </div>
      {results ? (
        <ul aria-label="Matching places" className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-1">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => choose(r)}
                className="min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {allowCurrentLocation ? (
        <Button type="button" variant="ghost" className="self-start px-3 text-sm" onClick={useCurrentLocation} disabled={busy !== null}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
          {busy === "gps" ? "Getting your location…" : "Use my current location"}
        </Button>
      ) : null}
    </div>
  );
}
