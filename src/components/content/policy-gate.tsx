"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";

/** A-09 #3: when the Terms or Privacy Policy change, ask people to accept before continuing. */
export function PolicyGate({ children }: { children: ReactNode }) {
  const pending = useQuery(api.content.pendingAcceptance);
  const accept = useMutation(api.content.acceptPolicies);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!pending || pending.length === 0) return <>{children}</>;
  const names = pending.map((p) => p.label).join(" and ");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream p-5">
      <section aria-labelledby="policy-title" className="flex w-full max-w-md flex-col gap-4 rounded-[24px] bg-surface p-6 shadow-float">
        <h1 id="policy-title" className="text-[22px] font-bold">We&apos;ve updated our {names}</h1>
        <p className="text-sm text-ink-2">Please read the new version before you continue.</p>
        <ul className="flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.kind}>
              <a href={`/${p.kind}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-2xl bg-surface-2 px-4 text-sm font-semibold">
                {p.label} (version {p.version})
                <span className="text-xs font-normal text-ink-2">opens in a new tab</span>
              </a>
            </li>
          ))}
        </ul>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-navy-900)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I&apos;ve read and accept the updated {names}.</span>
        </label>
        <Button
          type="button"
          variant="gold"
          disabled={!checked || busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await accept(Object.fromEntries(pending.map((p) => [p.kind, p.version])));
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Accept and continue
        </Button>
      </section>
    </main>
  );
}
