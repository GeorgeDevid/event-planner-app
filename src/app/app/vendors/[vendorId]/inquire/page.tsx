"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { PageHeader, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { errorField, errorMessage } from "@/lib/errors";
import { parseDollars, shortAddress, torontoTodayIso } from "@/lib/format";

export default function InquirePage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <InquiryForm />
    </Suspense>
  );
}

const centsToText = (c: number | null | undefined) => (c != null ? String(c / 100) : "");

/** C-12: send an inquiry, pre-filled from the chosen event. */
function InquiryForm() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const id = vendorId as Id<"vendors">;
  const search = useSearchParams();
  const router = useRouter();
  const profile = useQuery(api.vendors.publicProfile, { vendorId: id });
  const events = useQuery(api.events.forVendor, { vendorId: id });
  const [eventId, setEventId] = useState<string | null>(search.get("event"));
  const chosen = eventId || (events && events.length > 0 && eventId === null ? events[0]._id : "");
  const event = useQuery(api.events.get, chosen ? { eventId: chosen as Id<"events"> } : "skip");

  if (profile === undefined || events === undefined || (chosen && event === undefined)) return <FullPageLoader />;
  if (!profile || profile.isPreview) {
    return <p className="p-6 text-sm text-ink-2">This vendor is no longer available.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Message ${profile.companyName}`} eyebrow="Send an inquiry" backHref={`/app/vendors/${id}`} />
      {events.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">About which event?</span>
          <select
            value={chosen}
            onChange={(e) => setEventId(e.target.value)}
            className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
          >
            {events.map((e) => (
              <option key={e._id} value={e._id}>{e.name}</option>
            ))}
            <option value="">Not for one of my events</option>
          </select>
        </label>
      ) : null}
      <Fields
        key={chosen || "none"}
        vendorId={id}
        categories={profile.categoryOptions}
        defaultCategory={search.get("cat")}
        event={chosen && event ? event : null}
        onSent={(inquiryId) => router.replace(`/app/messages/${inquiryId}`)}
      />
    </div>
  );
}

function Fields({
  vendorId,
  categories,
  defaultCategory,
  event,
  onSent,
}: {
  vendorId: Id<"vendors">;
  categories: { _id: Id<"categories">; name: string }[];
  defaultCategory: string | null;
  event: { _id: Id<"events">; date: string | null; address: string | null; guestCount: number | null; budgetMinCents: number | null; budgetMaxCents: number | null; services: { _id: Id<"categories"> }[] } | null;
  onSent: (id: Id<"inquiries">) => void;
}) {
  const send = useMutation(api.inquiries.send);
  const router = useRouter();
  const needed = categories.find((c) => event?.services.some((s) => s._id === c._id));
  const [categoryId, setCategoryId] = useState<string>(
    needed?._id ?? categories.find((c) => c._id === defaultCategory)?._id ?? categories[0]?._id ?? "",
  );
  const [date, setDate] = useState(event?.date ?? "");
  const [location, setLocation] = useState(event?.address ? shortAddress(event.address) : "");
  const [guests, setGuests] = useState(event?.guestCount ? String(event.guestCount) : "");
  const [min, setMin] = useState(centsToText(event?.budgetMinCents));
  const [max, setMax] = useState(centsToText(event?.budgetMaxCents));
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = torontoTodayIso();

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError(null);
        const next: Record<string, string> = {};
        if (!message.trim()) next.message = "Write a message to the vendor.";
        if (date && date < today) next.date = "The date can't be in the past.";
        if (guests && (!Number.isInteger(Number(guests)) || Number(guests) < 1)) next.guestCount = "1 or more.";
        const minC = min.trim() ? parseDollars(min) : null;
        const maxC = max.trim() ? parseDollars(max) : null;
        if ((min.trim() && minC === null) || (max.trim() && maxC === null)) next.budgetMin = "Enter amounts in dollars.";
        if (minC !== null && maxC !== null && minC > maxC) next.budgetMin = "The minimum can't be more than the maximum.";
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        setPending(true);
        try {
          const id = await send({
            vendorId,
            eventId: event?._id,
            categoryId: (categoryId || undefined) as Id<"categories"> | undefined,
            date: date || undefined,
            location: location.trim() || undefined,
            guestCount: guests ? Number(guests) : undefined,
            budgetMinCents: minC ?? undefined,
            budgetMaxCents: maxC ?? undefined,
            message,
          });
          onSent(id);
        } catch (err) {
          // Already talking to this vendor: go to that conversation.
          if (err instanceof ConvexError && (err.data as { inquiryId?: string }).inquiryId) {
            router.replace(`/app/messages/${(err.data as { inquiryId: string }).inquiryId}`);
            return;
          }
          const field = errorField(err);
          if (field) setErrors({ [field]: errorMessage(err) });
          else setFormError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      {categories.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Service</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]">
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="text-sm text-ink-2">The vendor sees these details. Change anything that&apos;s different for this service.</p>
      <div className="flex gap-3">
        <TextField id="inq-date" label="Date" type="date" min={today} className="flex-1" value={date} error={errors.date} onChange={(e) => setDate(e.target.value)} />
        <TextField id="inq-guests" label="Guests" inputMode="numeric" className="w-28" value={guests} error={errors.guestCount} onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <TextField id="inq-location" label="Location" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
      <div className="flex gap-3">
        <TextField id="inq-min" label="Budget min (CAD)" inputMode="decimal" className="flex-1" value={min} error={errors.budgetMin} onChange={(e) => setMin(e.target.value)} />
        <TextField id="inq-max" label="Budget max (CAD)" inputMode="decimal" className="flex-1" value={max} onChange={(e) => setMax(e.target.value)} />
      </div>
      <TextArea
        id="inq-message"
        label="Message"
        maxLength={1000}
        required
        value={message}
        error={errors.message}
        placeholder="Hi! We'd love to know if you're free and what a package would cost…"
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Sending…" : "Send inquiry"}</Button>
    </form>
  );
}
