"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { PageHeader, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { errorField, errorMessage } from "@/lib/errors";
import { formatPrice, parseDollars, torontoTodayIso } from "@/lib/format";

export default function BookPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <BookingForm />
    </Suspense>
  );
}

/** C-14: request a booking. No payment in the app. */
function BookingForm() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const id = vendorId as Id<"vendors">;
  const search = useSearchParams();
  const router = useRouter();
  const profile = useQuery(api.vendors.publicProfile, { vendorId: id });
  const events = useQuery(api.events.forVendor, { vendorId: id });
  const request = useMutation(api.bookings.request);

  const [eventId, setEventId] = useState<string | null>(search.get("event"));
  const [date, setDate] = useState<string | null>(null);
  const [packageId, setPackageId] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = torontoTodayIso();

  if (profile === undefined || events === undefined) return <FullPageLoader />;
  if (!profile || profile.isPreview) return <p className="p-6 text-sm text-ink-2">This vendor is no longer available.</p>;

  const chosen = eventId ?? (events[0]?._id ?? "");
  const event = events.find((e) => e._id === chosen) ?? null;
  const serviceDate = date ?? event?.date ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Request booking" eyebrow={profile.companyName} backHref={`/app/vendors/${id}`} />
      <p className="rounded-[20px] bg-info-bg px-4 py-3 text-sm font-medium text-info">
        Payment is arranged directly with the vendor. The app doesn&apos;t process payments.
      </p>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setFormError(null);
          const next: Record<string, string> = {};
          if (!serviceDate) next.serviceDate = "Choose the service date.";
          else if (serviceDate < today) next.serviceDate = "The date can't be in the past.";
          const cents = price.trim() ? parseDollars(price) : null;
          if (price.trim() && cents === null) next.agreedPrice = "Enter the price in dollars.";
          setErrors(next);
          if (Object.keys(next).length > 0) return;
          setPending(true);
          try {
            const res = await request({
              vendorId: id,
              eventId: (chosen || undefined) as Id<"events"> | undefined,
              serviceDate,
              packageId: (packageId || undefined) as Id<"packages"> | undefined,
              agreedPriceCents: cents ?? undefined,
              notes: notes.trim() || undefined,
            });
            router.replace(`/app/messages/${res.inquiryId}`);
          } catch (err) {
            const field = errorField(err);
            if (field) setErrors({ [field]: errorMessage(err) });
            else setFormError(errorMessage(err));
          } finally {
            setPending(false);
          }
        }}
      >
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        {events.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Event</span>
            <select
              value={chosen}
              onChange={(e) => {
                setEventId(e.target.value);
                setDate(null);
              }}
              className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
            >
              {events.map((e) => (
                <option key={e._id} value={e._id}>{e.name}</option>
              ))}
              <option value="">Not for one of my events</option>
            </select>
          </label>
        ) : null}
        <TextField id="bk-date" label="Service date" type="date" min={today} required value={serviceDate} error={errors.serviceDate} onChange={(e) => setDate(e.target.value)} />
        {profile.packages.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-2">Package (optional)</span>
            <select
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                const p = profile.packages.find((x) => x._id === e.target.value);
                if (p && !price) setPrice(String(p.priceCents / 100));
              }}
              className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
            >
              <option value="">No package</option>
              {profile.packages.map((p) => (
                <option key={p._id} value={p._id}>{p.name} · {formatPrice(p)}</option>
              ))}
            </select>
          </label>
        ) : null}
        <TextField id="bk-price" label="Agreed price in CAD (optional)" inputMode="decimal" value={price} error={errors.agreedPrice} helper="If you've agreed a price in messages, note it here." onChange={(e) => setPrice(e.target.value)} />
        <TextArea id="bk-notes" label="Notes (optional)" maxLength={1000} value={notes} error={errors.notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" variant="gold" disabled={pending}>{pending ? "Sending…" : "Send booking request"}</Button>
      </form>
    </div>
  );
}
