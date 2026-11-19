"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { errorField, errorMessage } from "@/lib/errors";

/** Change password after confirming the current one (any account type). */
export function ChangePasswordForm() {
  const change = useMutation(api.account.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const me = useMe();

  if (!me.hasPassword) return <PasswordSetup />;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setDone(false);
        const nextErrors: Record<string, string> = {};
        if (!current) nextErrors.current = "Enter your current password.";
        if (next.length < 10) nextErrors.next = "Use at least 10 characters.";
        if (confirm !== next) nextErrors.confirm = "The passwords don't match.";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setPending(true);
        try {
          await change({ current, next });
          setDone(true);
          setCurrent("");
          setNext("");
          setConfirm("");
        } catch (err) {
          const field = errorField(err);
          setErrors({ [field ?? "form"]: errorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      {errors.form ? <FormAlert>{errors.form}</FormAlert> : null}
      {done ? (
        <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success">
          Password changed. Use the new one next time you log in.
        </p>
      ) : null}
      <TextField id="pw-current" label="Current password" type="password" autoComplete="current-password" value={current} error={errors.current} onChange={(e) => setCurrent(e.target.value)} />
      <TextField id="pw-next" label="New password" type="password" autoComplete="new-password" helper="At least 10 characters." value={next} error={errors.next} onChange={(e) => setNext(e.target.value)} />
      <TextField id="pw-confirm" label="Confirm new password" type="password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" disabled={pending} className="self-start">{pending ? "Saving…" : "Change password"}</Button>
    </form>
  );
}

/** Accounts made with Google have no password; offer to email a link to add one. */
function PasswordSetup() {
  const request = useMutation(api.account.requestPasswordSetup);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">
        You sign in with Google, so there&apos;s no password to change. You can add one to also log in with your email.
      </p>
      {sentTo ? <FormAlert tone="info">We sent a link to {sentTo}. It works for one hour.</FormAlert> : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            setSentTo((await request({})).email);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Sending…" : "Email me a link to add a password"}
      </Button>
    </div>
  );
}
