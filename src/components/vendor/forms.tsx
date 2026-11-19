"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { Switch } from "@/components/ui/kit";
import { AddressAutocomplete } from "@/components/location/address-autocomplete";
import { errorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { checkFile, DOCUMENT_ACCEPT, uploadToConvex } from "@/lib/upload";
import type { MyVendor } from "./use-vendor";

const MapPicker = dynamic(() => import("@/components/location/map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-[20px] bg-surface-2" />,
});

type FormProps = { vendor: MyVendor; submitLabel: string; onSaved?: () => void };

// ---------------------------------------------------------------------------
// V-01 business details
// ---------------------------------------------------------------------------

export function BusinessDetailsForm({ vendor, submitLabel, onSaved }: FormProps) {
  const update = useMutation(api.vendors.updateDetails);
  const [companyName, setCompanyName] = useState(vendor.companyName);
  const [ownerName, setOwnerName] = useState(vendor.ownerName);
  const [phone, setPhone] = useState(vendor.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await update({ companyName, ownerName, phone });
          onSaved?.();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TextField id="companyName" label="Company name" autoComplete="organization" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
      <TextField id="ownerName" label="Owner or contact name" autoComplete="name" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      <TextField id="phone" type="tel" label="Business phone (optional)" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} helper="Shown to clients only after you accept their booking." />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// V-01 categories
// ---------------------------------------------------------------------------

export function CategoriesForm({ vendor, submitLabel, onSaved }: FormProps) {
  const categories = useQuery(api.catalog.categories);
  const save = useMutation(api.vendors.setCategories);
  const [selected, setSelected] = useState<Id<"categories">[]>(vendor.categoryIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const toggle = (id: Id<"categories">) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await save({ categoryIds: selected });
          onSaved?.();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <fieldset>
        <legend className="text-sm text-ink-2">
          Choose up to 5 services you offer. Clients find you under these.
        </legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories === undefined
            ? Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="h-11 w-28 animate-pulse rounded-full bg-surface-2" />
              ))
            : categories.map((c) => {
                const on = selected.includes(c._id);
                return (
                  <label
                    key={c._id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-card transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text ${
                      on ? "bg-navy-900 text-white" : "bg-surface text-navy-900"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(c._id)} />
                    {on ? (
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    ) : null}
                    {c.name}
                  </label>
                );
              })}
        </div>
      </fieldset>
      <p className="text-sm text-ink-2" aria-live="polite">
        {selected.length} selected
      </p>
      <Button type="submit" disabled={pending || selected.length === 0} className="w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// V-02 location and service radius
// ---------------------------------------------------------------------------

const GTA_CENTRE = { lat: 43.6532, lng: -79.3832 };

export function LocationForm({ vendor, submitLabel, onSaved }: FormProps) {
  const save = useMutation(api.vendors.setLocation);

  const [address, setAddress] = useState(vendor.address ?? "");
  const [point, setPoint] = useState(vendor.location ?? null);
  const [radius, setRadius] = useState(vendor.serviceRadiusKm);
  const [clientsComeToMe, setClientsComeToMe] = useState(vendor.clientsComeToMe);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const area = address.split(",").slice(0, 2).join(",").trim() || "your location";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!point) {
          setAddressError("Pick your address from the suggestions first.");
          return;
        }
        setPending(true);
        try {
          await save({
            address: address.trim(),
            lat: point.lat,
            lng: point.lng,
            serviceRadiusKm: radius,
            clientsComeToMe,
          });
          onSaved?.();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <AddressAutocomplete
        id="address"
        label="Business address"
        text={address}
        error={addressError}
        onTextChange={(t) => {
          setAddress(t);
          setPoint(null);
          setAddressError(null);
        }}
        onPick={(place) => {
          setAddress(place.address);
          setPoint({ lat: place.lat, lng: place.lng });
        }}
      />

      <div className="flex flex-col gap-2">
        <MapPicker
          point={point ?? GTA_CENTRE}
          radiusKm={radius}
          showRadius={!clientsComeToMe}
          onMove={(p) => setPoint(p)}
        />
        <p className="text-[13px] text-ink-2">
          {point
            ? "Drag the pin or tap the map if it isn't quite right."
            : "Pick your address to place the pin."}
        </p>
      </div>

      <Switch
        checked={clientsComeToMe}
        onChange={setClientsComeToMe}
        label="Clients come to me"
        description="For salons, spas and studios that serve clients at their own location."
      />

      {!clientsComeToMe ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="radius" className="text-xs font-semibold text-ink-2">
              Service radius
            </label>
            <span className="text-[15px] font-bold">{radius} km</span>
          </div>
          <input
            id="radius"
            type="range"
            min={5}
            max={200}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="h-11 w-full accent-navy-900"
          />
          <p className="text-sm text-ink-2" aria-live="polite">
            Serving within {radius} km of {area}.
          </p>
        </div>
      ) : null}

      <Button type="submit" disabled={pending || !point} className="w-full">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// V-01 supporting documents
// ---------------------------------------------------------------------------

export function DocumentsForm({ vendor }: { vendor: MyVendor }) {
  const generateUploadUrl = useMutation(api.vendors.generateUploadUrl);
  const addDocument = useMutation(api.vendors.addDocument);
  const removeDocument = useMutation(api.vendors.removeDocument);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const problem = checkFile(file, "document");
        if (problem) {
          setError(problem);
          continue;
        }
        const storageId = await uploadToConvex(generateUploadUrl, file);
        await addDocument({ storageId, name: file.name });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Optional, but it speeds up approval: a business licence, registration or photo ID. PDF, JPG
        or PNG, up to 10 MB each. Only our team can see these.
      </p>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {vendor.documents.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {vendor.documents.map((d) => (
            <li key={d._id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold-text">
                <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
                <path d="M14 3v5h5" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{d.name}</span>
                <span className="block text-xs text-ink-2">{formatBytes(d.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => removeDocument({ documentId: d._id })}
                className="min-h-11 rounded-full px-3 text-sm font-semibold text-danger hover:bg-danger-bg"
              >
                Remove<span className="sr-only"> {d.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-dashed border-control bg-surface px-4 py-5 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text">
        <input
          ref={input}
          type="file"
          accept={DOCUMENT_ACCEPT}
          multiple
          disabled={uploading}
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
        <span className="text-[15px] font-semibold">
          {uploading ? "Uploading…" : "Upload documents"}
        </span>
        <span className="text-[13px] text-ink-2">Up to 5 files</span>
      </label>
    </div>
  );
}
