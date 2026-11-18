"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useQueryState, VendorResults } from "@/components/client/vendor-results";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { errorMessage } from "@/lib/errors";
import { formatBudget, formatIsoDate, shortAddress } from "@/lib/format";

const STATUS_LABEL = {
  not_started: "Not started",
  shortlisted: "Vendors saved",
  inquiry_sent: "Inquiry sent",
  booking_requested: "Booking requested",
  booked: "Booked",
} as const;

export default function EventDashboardPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <EventDashboard />
    </Suspense>
  );
}

/** C-07: the event summary and nearby vendors for each service it needs. */
function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = eventId as Id<"events">;
  const router = useRouter();
  const event = useQuery(api.events.get, { eventId: id });
  const [params, setParams] = useQueryState();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (event?.status === "draft") router.replace(`/app/events/${id}/setup`);
  }, [event?.status, id, router]);

  if (event === undefined || event.status === "draft") return <FullPageLoader />;

  const current = event.services.find((s) => s._id === params.get("service")) ?? event.services[0];
  const budget = formatBudget(event.budgetMinCents, event.budgetMaxCents);

  return (
    <div className="-mx-5 -mt-6 flex flex-col gap-6">
      <section aria-label="Event summary" className="relative overflow-hidden rounded-b-[28px] bg-dusk px-5 pt-6 pb-6 text-white">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-navy-900/10 to-navy-900/80" />
        <div className="relative flex items-center justify-between">
          <Link href="/app/events" aria-label="Back to my events" className="flex size-11 items-center justify-center rounded-full bg-white text-navy-900 shadow-card">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <button type="button" onClick={() => setMenuOpen(true)} className="min-h-11 rounded-full bg-navy-900/60 px-4 text-sm font-semibold">
            Edit
          </button>
        </div>
        <div className="relative mt-16">
          <p className="text-xs font-semibold text-gold-300">{event.eventType?.name ?? "Event"}</p>
          <h1 className="font-display text-[34px] leading-[1.05] font-bold">{event.name}</h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-xs text-on-navy-2">Date</dt><dd className="font-semibold">{event.date ? formatIsoDate(event.date) : "—"}</dd></div>
            <div><dt className="text-xs text-on-navy-2">Guests</dt><dd className="font-semibold">{event.guestCount ?? "—"}</dd></div>
            <div><dt className="text-xs text-on-navy-2">Location</dt><dd className="truncate font-semibold">{event.address ? shortAddress(event.address) : "—"}</dd></div>
            <div><dt className="text-xs text-on-navy-2">Budget</dt><dd className="font-semibold">{budget ?? "Not set"}</dd></div>
          </dl>
          {event.functions.length > 0 ? (
            <ul aria-label="Functions" className="mt-3 flex flex-wrap gap-1.5">
              {event.functions.map((f, i) => (
                <li key={`${f.name}-${i}`} className="rounded-full bg-navy-900/55 px-3 py-1 text-xs">
                  {f.name}
                  {f.date ? ` · ${formatIsoDate(f.date, { weekday: false })}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-5 px-5">
        {event.services.length === 0 ? (
          <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
            <p className="font-semibold">No services selected</p>
            <Link href={`/app/events/${id}/setup?step=services`} className="mt-2 inline-block text-sm font-semibold text-gold-text">Choose services</Link>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Services" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {event.services.map((s) => {
                const active = s._id === current?._id;
                return (
                  <button
                    key={s._id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setParams({ service: s._id })}
                    className={`flex shrink-0 flex-col items-start rounded-[18px] px-4 py-2 text-left ${active ? "bg-navy-900 text-white" : "bg-surface text-navy-900 shadow-card"}`}
                  >
                    <span className="text-sm font-semibold whitespace-nowrap">{s.name}</span>
                    <span className={`text-xs whitespace-nowrap ${active ? "text-gold-300" : s.status === "not_started" ? "text-ink-2" : "text-gold-text"}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </button>
                );
              })}
            </div>
            {current && event.location ? (
              <VendorResults
                key={current._id}
                categoryId={current._id}
                serviceName={current.name}
                point={event.location}
                date={event.date}
                defaultBudget={{ min: event.budgetMinCents, max: event.budgetMaxCents }}
                savedIds={event.shortlistedVendorIds}
              />
            ) : null}
          </>
        )}
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Edit event">
        <EditMenu eventId={id} hasQuestions={!!event.eventType && (event.eventType.questions.length > 0 || event.eventType.subFunctions.length > 0)} />
      </Sheet>
    </div>
  );
}

function EditMenu({ eventId, hasQuestions }: { eventId: Id<"events">; hasQuestions: boolean }) {
  const router = useRouter();
  const cancel = useMutation(api.events.cancel);
  const duplicate = useMutation(api.events.duplicate);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = "flex min-h-14 items-center justify-between rounded-[18px] bg-surface-2 px-4 text-[15px] font-semibold";
  return (
    <div className="flex flex-col gap-2">
      <Link className={link} href={`/app/events/${eventId}/setup?step=basics`}>Date, location, guests and budget <span aria-hidden="true">›</span></Link>
      {hasQuestions ? <Link className={link} href={`/app/events/${eventId}/setup?step=questions`}>Event questions <span aria-hidden="true">›</span></Link> : null}
      <Link className={link} href={`/app/events/${eventId}/setup?step=services`}>Services <span aria-hidden="true">›</span></Link>
      <button
        type="button"
        className={link}
        onClick={async () => {
          try {
            const copy = await duplicate({ eventId });
            router.push(`/app/events/${copy}/setup?step=basics`);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        Duplicate event <span aria-hidden="true">›</span>
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {confirming ? (
        <div className="mt-2 flex flex-col gap-2 rounded-[18px] border border-danger/30 p-4">
          <p className="text-sm">Cancel this event? Open booking requests are cancelled, and vendors you&apos;ve contacted are told.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              onClick={async () => {
                try {
                  await cancel({ eventId });
                  router.replace("/app/events");
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            >
              Cancel event
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" className="mt-2 text-danger" onClick={() => setConfirming(true)}>Cancel event</Button>
      )}
    </div>
  );
}
