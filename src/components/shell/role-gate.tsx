"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { PolicyGate } from "@/components/content/policy-gate";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { FullPageLoader } from "@/components/ui/loader";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <RoleGate>");
  return me;
}

/** Where each role lands after logging in. */
export function homeFor(me: Pick<Me, "role" | "onboarded">): string {
  if (!me.onboarded) return "/onboarding";
  if (me.role === "admin") return "/admin";
  if (me.role === "vendor") return "/vendor";
  return "/app";
}

/**
 * Shows its children only to a signed-in, onboarded user with the given role
 * and sends everyone else to the right place. This is a convenience for
 * navigation; the Convex functions enforce roles and permissions themselves.
 */
export function RoleGate({
  role,
  children,
}: {
  role: Me["role"];
  children: ReactNode;
}) {
  const me = useQuery(api.users.me);
  const router = useRouter();

  const allowed = me && me.onboarded && me.role === role;
  // A-01 #1: signed-in people who aren't admins get a 403, not a redirect.
  const forbidden = role === "admin" && !!me && me.onboarded && me.role !== "admin";

  useEffect(() => {
    if (me === undefined || allowed || forbidden) return;
    router.replace(me === null ? "/sign-in" : homeFor(me));
  }, [me, allowed, forbidden, router]);

  if (forbidden) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream p-6 text-center">
        <p className="font-display text-[56px] leading-none font-bold text-gold-display">403</p>
        <h1 className="text-[22px] font-bold">You don&apos;t have access to the admin portal</h1>
        <p className="max-w-sm text-sm text-ink-2">This area is only for Event Planner staff. If you think you should have access, ask a Super Admin.</p>
        <Link href={homeFor(me)} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-navy-900 px-6 text-[15px] font-semibold text-white">
          Go to my home
        </Link>
      </main>
    );
  }
  if (!allowed) return <FullPageLoader />;
  return (
    <MeContext.Provider value={me}>
      <PolicyGate>{children}</PolicyGate>
    </MeContext.Provider>
  );
}
