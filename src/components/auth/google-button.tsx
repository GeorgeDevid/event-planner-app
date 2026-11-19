"use client";

import { useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { FormAlert } from "@/components/ui/field";

/**
 * "Continue with Google" plus an "or" divider. Hidden until Google
 * credentials are set on the backend. Sign-in and sign-up are the same flow:
 * a new Google account goes on to onboarding.
 */
export function GoogleSignIn({ label = "Continue with Google" }: { label?: string }) {
  const options = useQuery(api.auth.signInOptions);
  const { signIn } = useSignInWithGoogle(api.auth);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!options?.google) return null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          // Google sends people back here; that page finishes signing in.
          const result = await signIn({ redirectTo: `${window.location.origin}/oauth-return` });
          if (result.status === "error") {
            setError(authErrorMessage(result.userError));
            setPending(false);
          }
        }}
        className="press flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border border-control bg-surface px-6 text-[15px] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-navy-900 text-[13px] font-bold text-white">
          G
        </span>
        {pending ? "Opening Google…" : label}
      </button>
      <div className="flex items-center gap-3 text-xs font-semibold text-ink-2" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
