"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { Card, PageHeader, Segmented, Sheet, Switch, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { useMyVendor } from "@/components/vendor/use-vendor";
import { errorMessage } from "@/lib/errors";
import { formatCents, formatPrice, parseDollars, UNIT_LABEL } from "@/lib/format";

type Package = Doc<"packages">;
type Unit = keyof typeof UNIT_LABEL;

/** V-04: packages and pricing, with the computed average price. */
export default function VendorPackages() {
  const vendor = useMyVendor();
  const setActive = useMutation(api.vendors.setPackageActive);
  const [editing, setEditing] = useState<Package | "new" | null>(null);

  if (vendor === undefined) return <FullPageLoader />;
  const activeCount = vendor.packages.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Packages & pricing" backHref="/vendor" />

      <section className="flex flex-col gap-1 rounded-[20px] bg-navy-900 p-5 text-white shadow-card">
        <p className="text-xs font-semibold text-gold-300">Average price</p>
        <p className="text-[34px] leading-tight font-bold">
          {vendor.avgPriceCents ? formatCents(vendor.avgPriceCents) : "Price on request"}
          {vendor.avgPriceCents ? <span className="text-base font-medium text-on-navy-2"> CAD</span> : null}
        </p>
        <p className="text-sm text-on-navy-2">
          Worked out from your {activeCount} active package{activeCount === 1 ? "" : "s"}. Clients
          see it on your card and filter by it.
        </p>
      </section>

      {vendor.packages.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            You don&apos;t have any packages yet. Add at least one so clients can see your prices and
            find you with the budget filter.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {vendor.packages.map((p) => (
            <li
              key={p._id}
              className={`flex flex-col gap-3 rounded-[20px] p-5 shadow-card ${
                p.active ? "bg-surface" : "border-2 border-dashed border-control bg-surface-2"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold">{p.name}</h2>
                  <p className="text-sm font-bold">{formatPrice(p)}</p>
                  {p.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-2">{p.description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="min-h-11 rounded-full px-3 text-sm font-semibold text-gold-text hover:bg-surface-2"
                >
                  Edit<span className="sr-only"> {p.name}</span>
                </button>
              </div>
              <Switch
                checked={p.active}
                onChange={(active) => setActive({ packageId: p._id, active })}
                label={p.active ? "Active" : "Inactive"}
                description={p.active ? "Shown to clients" : "Hidden from clients and the average price"}
              />
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="gold" className="w-full" onClick={() => setEditing("new")}>
        Add package
      </Button>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add package" : "Edit package"}
      >
        {editing !== null ? (
          <PackageForm pkg={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
        ) : null}
      </Sheet>
    </div>
  );
}

function PackageForm({ pkg, onDone }: { pkg: Package | null; onDone: () => void }) {
  const create = useMutation(api.vendors.createPackage);
  const update = useMutation(api.vendors.updatePackage);
  const remove = useMutation(api.vendors.deletePackage);
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [price, setPrice] = useState(pkg ? String(pkg.priceCents / 100) : "");
  const [priceType, setPriceType] = useState<"fixed" | "starting_from">(pkg?.priceType ?? "fixed");
  const [unit, setUnit] = useState<Unit>(pkg?.unit ?? "per_event");
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPriceError(null);
        const priceCents = parseDollars(price);
        if (priceCents === null) {
          setPriceError("Enter a price in dollars, for example 2400.");
          return;
        }
        setPending(true);
        try {
          const fields = { name, description, priceCents, priceType, unit };
          if (pkg) await update({ packageId: pkg._id, ...fields });
          else await create(fields);
          onDone();
        } catch (err) {
          setError(errorMessage(err));
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TextField id="pkg-name" label="Package name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <TextArea id="pkg-description" label="What's included (optional)" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      <TextField
        id="pkg-price"
        label="Price (CAD)"
        inputMode="decimal"
        required
        value={price}
        error={priceError}
        onChange={(e) => setPrice(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-2">Price type</span>
        <Segmented
          label="Price type"
          value={priceType}
          onChange={setPriceType}
          options={[
            { value: "fixed", label: "Fixed" },
            { value: "starting_from", label: "Starting from" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pkg-unit" className="text-xs font-semibold text-ink-2">
          Charged
        </label>
        <select
          id="pkg-unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit)}
          className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
        >
          {Object.entries(UNIT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="gold" disabled={pending} className="mt-2 w-full">
        {pending ? "Saving…" : "Save package"}
      </Button>
      {pkg ? (
        confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-danger-bg p-4">
            <p className="text-sm font-medium text-danger">
              Delete &ldquo;{pkg.name}&rdquo;? Clients will no longer see it.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  try {
                    await remove({ packageId: pkg._id });
                    onDone();
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
              >
                Delete package
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            Delete package
          </Button>
        )
      ) : null}
    </form>
  );
}
