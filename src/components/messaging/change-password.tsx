"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
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
