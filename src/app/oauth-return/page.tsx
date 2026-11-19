"use client";

import { useOauth } from "@convex-dev/auth/methods/google/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/ui/field";
import { FullPageLoader } from "@/components/ui/loader";
import { takeNext } from "@/lib/next-path";

const FLOW_MESSAGES: Record<string, string> = {
  ACCESS_DENIED: "Google sign-in was cancelled.",
  EXPIRED: "That sign-in took too long. Please try again.",
  INVALID_FLOW: "We couldn't finish signing you in. Please start again from this browser.",
};

/**
 * Google sends people back here with a one-time code. The auth provider
 * redeems it on page load; once signed in we go on to where they were heading
 * (or onboarding for a new account, via /home).
 */
export default function OauthReturn() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { flowError } = useOauth();
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace(takeNext() ?? "/home");
  }, [isAuthenticated, router]);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, []);

  if (flowError || (slow && !isAuthenticated && !isLoading)) {
    const message = flowError
      ? flowError.error === "OTHER_ERROR"
        ? authErrorMessage({ error: "OTHER_ERROR", cause: flowError.cause })
        : FLOW_MESSAGES[flowError.error]
      : "We couldn't finish signing you in.";
    return (
      <AuthShell title="Almost there," accent="let's try that again">
        <h2 className="text-[28px] leading-tight font-bold tracking-tight">Google sign-in didn&apos;t finish</h2>
        <div className="mt-4">
          <FormAlert>{message}</FormAlert>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/sign-in" className="font-semibold text-gold-text underline-offset-4 hover:underline">
            Back to Log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return <FullPageLoader label="Signing you in with Google" />;
}
