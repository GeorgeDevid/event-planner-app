"use client";

import { Suspense } from "react";
import { ServiceSearch } from "@/components/client/service-search";
import { FullPageLoader } from "@/components/ui/loader";

export default function SearchPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ServiceSearch />
    </Suspense>
  );
}
