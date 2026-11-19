"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete, type Place } from "@/components/location/address-autocomplete";

export type { Place };

const MapPicker = dynamic(() => import("@/components/location/map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-44 w-full animate-pulse rounded-[20px] bg-surface-2" />,
});

/**
 * Where an event is, or where to search from (C-03 #1-2, C-04 #5): address
 * suggestions as you type, an optional "Use my current location" button, and
 * a small map whose pin can be dragged to fine-tune the spot. Calls onChange
 * with the chosen place, or null while the text no longer matches one.
 */
export function LocationField({
  id,
  label,
  value,
  onChange,
  error,
  allowCurrentLocation = false,
  helper,
  pinLabel = "Location",
}: {
  id: string;
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  error?: string | null;
  allowCurrentLocation?: boolean;
  helper?: string;
  pinLabel?: string;
}) {
  const [text, setText] = useState(value?.address ?? "");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    setGpsError(null);
    if (!("geolocation" in navigator)) {
      setGpsError("Location isn't available on this device. Type an address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setText("Current location");
        onChange({ address: "Current location", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGpsError("We couldn't get your location. Type an address instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AddressAutocomplete
        id={id}
        label={label}
        text={text}
        onTextChange={(t) => {
          setText(t);
          setGpsError(null);
          if (value) onChange(null);
        }}
        onPick={(place) => {
          setText(place.address);
          onChange(place);
        }}
        error={gpsError ?? error}
        helper={helper}
      />
      {allowCurrentLocation && !value ? (
        <Button type="button" variant="ghost" className="self-start px-3 text-sm" onClick={useCurrentLocation} disabled={locating}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
          {locating ? "Getting your location…" : "Use my current location"}
        </Button>
      ) : null}
      {value ? (
        <div className="flex flex-col gap-1.5">
          <MapPicker
            point={{ lat: value.lat, lng: value.lng }}
            radiusKm={0}
            showRadius={false}
            pinLabel={pinLabel}
            className="h-44"
            onMove={(p) => onChange({ ...value, lat: p.lat, lng: p.lng })}
          />
          <p className="text-[13px] text-ink-2">Drag the pin or tap the map if the spot isn&apos;t quite right.</p>
        </div>
      ) : null}
    </div>
  );
}
