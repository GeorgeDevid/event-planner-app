"use client";

import { useSignInWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { authErrorMessage } from "@/components/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";

export function SignInForm() {
  const router = useRouter();
  const { signIn, pending } = useSignInWithUsernamePassword(api.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn({
      username: email.trim().toLowerCase(),
      password,
    });
    if (result.status === "complete") {
      router.replace("/home");
      return;
    }
    // Suspended accounts are rejected by the server's onSignIn check (C-01).
    setError(authErrorMessage(result.userError));
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="username"
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
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={pending}
      />
      <Button type="submit" variant="gold" disabled={pending} className="mt-2 w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
