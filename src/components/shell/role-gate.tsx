"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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

  useEffect(() => {
    if (me === undefined || allowed) return;
    router.replace(me === null ? "/sign-in" : homeFor(me));
  }, [me, allowed, router]);

  if (!allowed) return <FullPageLoader />;
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}
