"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ReportSheet } from "@/components/messaging/report-sheet";
import { VendorReviews } from "@/components/reviews/vendor-reviews";
import { LinkButton } from "@/components/ui/button";
import { Sheet, Switch } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { VendorProfileView } from "@/components/vendor/profile-view";
import { errorMessage } from "@/lib/errors";
import { signUpFor } from "@/lib/next-path";
import { formatCents, formatIsoDate } from "@/lib/format";

/** C-10: a vendor's profile as clients see it. Visitors get sign-up links instead of actions (C-01 #6). */
export function VendorProfilePage({ guest = false }: { guest?: boolean }) {
  const { vendorId } = useParams<{ vendorId: string }>();
  const id = vendorId as Id<"vendors">;
  const act = (path: string) => (guest ? signUpFor(path) : path);
  const router = useRouter();
  const profile = useQuery(api.vendors.publicProfile, { vendorId: id });
  const [adding, setAdding] = useState(false);
  const [reporting, setReporting] = useState(false);
  const recordView = useMutation(api.vendorStats.recordView);
  // V-08: count the visit (once per person per day, on the server).
  useEffect(() => {
    if (!guest) void recordView({ vendorId: id }).catch(() => {});
  }, [guest, id, recordView]);

  // Go back to the results so filters stay as they were (C-08 #7).
  const back = () => (window.history.length > 1 ? router.back() : router.push(guest ? "/vendors" : "/app"));
  const backButton = (
    <button type="button" onClick={back} aria-label="Back" className="press flex size-11 items-center justify-center rounded-full bg-white text-navy-900 shadow-card">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
    </button>
  );

  if (profile === undefined) return <FullPageLoader />;
  if (profile === null || profile.isPreview) {
    return (
      <div className="flex flex-col items-start gap-4 pt-4">
        {backButton}
        <div className="w-full rounded-[20px] bg-surface p-6 text-center shadow-card">
          <p className="font-semibold">This vendor is no longer available</p>
          <p className="mt-1 text-sm text-ink-2">They may have closed or paused their listing.</p>
          <LinkButton href={guest ? "/vendors" : "/app/search"} variant="secondary" className="mt-4">Find another vendor</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-5 -mt-6 lg:mx-0 lg:mt-0">
      <VendorProfileView
        profile={profile}
        topLeft={
          <>
            {backButton}
            <button
              type="button"
              onClick={() => (guest ? router.push(signUpFor(`/app/vendors/${id}`)) : setAdding(true))}
              className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-navy-900 shadow-card"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
              Add to my event
            </button>
          </>
        }
        footer={
          <>
            <VendorReviews vendorId={id} allowWrite={!guest} />
            {guest ? null : (
              <button type="button" onClick={() => setReporting(true)} className="min-h-11 self-start text-sm font-semibold text-ink-2 underline-offset-4 hover:underline">
                Report this vendor
              </button>
            )}
          </>
        }
        actions={
          <>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-on-navy-2">Avg. price</p>
              <p className="text-[18px] font-bold">{profile.avgPriceCents ? formatCents(profile.avgPriceCents) : "On request"}</p>
            </div>
            <LinkButton href={act(`/app/vendors/${id}/inquire`)} variant="secondary" className="min-h-11 border-0 px-4 text-sm">
              Message
            </LinkButton>
            <LinkButton href={act(`/app/vendors/${id}/book`)} variant="gold" className="min-h-11 px-4 text-sm">
              Request booking
            </LinkButton>
          </>
        }
      />
      {guest ? null : <ReportSheet open={reporting} onClose={() => setReporting(false)} title={`Report ${profile.companyName}`} target={{ targetType: "vendor", vendorId: id }} />}
      {guest ? null : (
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to my event">
        <AddToEvent vendorId={id} />
      </Sheet>
      )}
    </div>
  );
}

function AddToEvent({ vendorId }: { vendorId: Id<"vendors"> }) {
  const events = useQuery(api.events.forVendor, { vendorId });
  const setShortlisted = useMutation(api.events.setShortlisted);
  const [error, setError] = useState<string | null>(null);

  if (events === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (events.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">You don&apos;t have an upcoming event yet. Create one to save vendors to it.</p>
        <LinkButton href="/app/events/new">Plan an event</LinkButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">Saved vendors show on the event&apos;s dashboard.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="flex flex-col gap-4">
        {events.map((e) => (
          <li key={e._id}>
            <Switch
              checked={e.added}
              label={e.name}
              description={e.date ? formatIsoDate(e.date) : undefined}
              onChange={(added) => {
                setError(null);
                setShortlisted({ eventId: e._id, vendorId, added }).catch((err) => setError(errorMessage(err)));
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
