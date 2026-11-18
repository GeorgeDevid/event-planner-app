"use client";

import { Suspense } from "react";
import { EventWizard } from "@/components/client/event-wizard";
import { FullPageLoader } from "@/components/ui/loader";

/** C-04: start a new event. */
export default function NewEventPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <EventWizard />
    </Suspense>
  );
}
