"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { homeFor } from "@/components/shell/role-gate";
import { FullPageLoader } from "@/components/ui/loader";

/** Sends a signed-in person to their area: onboarding, client, vendor or admin. */
export default function HomeRouter() {
  const me = useQuery(api.users.me);
  const router = useRouter();
  useEffect(() => {
    if (me === undefined) return;
    router.replace(me === null ? "/sign-in" : homeFor(me));
  }, [me, router]);
  return <FullPageLoader label="Getting things ready" />;
}
