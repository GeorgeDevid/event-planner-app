"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button, LinkButton } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { errorField, errorMessage } from "@/lib/errors";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const reset = useMutation(api.account.resetPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <FormAlert>This link is incomplete. Open the link from the email again, or ask for a new one.</FormAlert>
        <LinkButton href="/forgot-password" variant="secondary">Get a new link</LinkButton>
      </div>
    );
  }
  if (done) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success">
          Your password has been changed.
        </p>
        <LinkButton href="/sign-in" variant="gold">Log in</LinkButton>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mt-6 flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (password.length < 10) next.password = "Use at least 10 characters.";
        if (confirm !== password) next.confirm = "The passwords don't match.";
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        setPending(true);
        try {
          await reset({ token, password });
          setDone(true);
        } catch (err) {
          setErrors({ [errorField(err) ?? "form"]: errorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      {errors.form ? (
        <FormAlert>
          {errors.form}{" "}
          <Link href="/forgot-password" className="font-semibold underline">Get a new link</Link>
        </FormAlert>
      ) : null}
      <TextField id="password" type="password" label="New password" autoComplete="new-password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
      <TextField id="confirm" type="password" label="Confirm new password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" variant="gold" disabled={pending} className="mt-2 w-full">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
