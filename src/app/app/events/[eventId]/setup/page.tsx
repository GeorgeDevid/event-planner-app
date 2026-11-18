"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { EventWizard } from "@/components/client/event-wizard";
import { FullPageLoader } from "@/components/ui/loader";

/** C-04 to C-06: continue a draft, or edit an event from its dashboard. */
export default function EventSetupPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <Suspense fallback={<FullPageLoader />}>
      <EventWizard eventId={eventId as Id<"events">} />
    </Suspense>
  );
}
