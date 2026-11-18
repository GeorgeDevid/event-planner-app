"use client";

import { useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";

const MIN_PASSWORD = 10;

export function SignUpForm() {
  const router = useRouter();
  const { signUp, pending } = useSignUpWithUsernamePassword(api.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    const result = await signUp({
      username: email.trim().toLowerCase(),
      password,
    });
    if (result.status === "complete") {
      router.replace("/onboarding");
      return;
    }
    const message = authErrorMessage(result.userError);
    if (result.userError.error.startsWith("PASSWORD")) setPasswordError(message);
    else setError(message);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={pending}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD}
        helper={`At least ${MIN_PASSWORD} characters. Avoid common passwords.`}
        error={passwordError}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={pending}
      />
      <Button type="submit" variant="gold" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
