"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useMe } from "@/components/shell/role-gate";
import { errorMessage } from "@/lib/errors";

/** Reminds people to confirm their email until they do (C-01 #1). */
export function VerifyEmailBanner() {
  const me = useMe();
  const resend = useMutation(api.emailVerification.resend);
  const [note, setNote] = useState<string | null>(null);
  if (me.emailVerified || !me.email) return null;
  return (
    <section aria-label="Confirm your email" className="flex flex-col gap-2 rounded-[20px] bg-gold-300/40 p-4 text-sm">
      <p>
        <span className="font-semibold">Confirm your email.</span> We sent a link to {me.email}. It keeps your inquiry and booking updates coming.
      </p>
      {note ? (
        <p role="status" className="font-medium">{note}</p>
      ) : (
        <button
          type="button"
          className="min-h-11 self-start rounded-full bg-navy-900 px-4 font-semibold text-white"
          onClick={async () => {
            try {
              const r = await resend({});
              setNote(r.status === "sent" ? "New link sent. Check your inbox (and spam)." : "Your email is already confirmed.");
            } catch (err) {
              setNote(errorMessage(err));
            }
          }}
        >
          Send a new link
        </button>
      )}
    </section>
  );
}
