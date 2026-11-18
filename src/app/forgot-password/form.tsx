"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { errorMessage } from "@/lib/errors";

export function ForgotPasswordForm() {
  const request = useMutation(api.account.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (sentTo) {
    return (
      <div role="status" className="mt-6 rounded-[20px] bg-surface-2 p-5 text-[15px]">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-ink-2">
          If {sentTo} has an account, we&apos;ve sent a link to reset the password. It expires in 1 hour. Check your spam folder if it
          doesn&apos;t arrive in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mt-6 flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const value = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setError("Enter a valid email address.");
          return;
        }
        setPending(true);
        try {
          await request({ email: value });
          setSentTo(value);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TextField id="email" type="email" label="Email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" variant="gold" disabled={pending} className="mt-2 w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
