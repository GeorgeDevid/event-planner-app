"use client";

import { useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { LinkButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const verify = useMutation(api.emailVerification.verify);
  const [state, setState] = useState<"working" | "done" | { error: string }>(() =>
    token ? "working" : { error: "This link is incomplete. Open the link from the email again." },
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify({ token })
      .then(() => setState("done"))
      .catch((err) => setState({ error: errorMessage(err) }));
  }, [token, verify]);

  if (state === "working") return <p role="status" className="mt-4 text-sm text-ink-2">Confirming…</p>;
  if (state === "done") {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success">Your email is confirmed. Thank you!</p>
        <LinkButton href="/home" variant="gold">Continue</LinkButton>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      <p className="text-sm text-ink-2">You can send a new link from the banner on your home screen after logging in.</p>
      <LinkButton href="/home" variant="secondary">Go to my home</LinkButton>
    </div>
  );
}
