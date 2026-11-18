import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Suspense } from "react";
import { IdleNotice } from "./idle-notice";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Log in" };

export default function SignInPage() {
  return (
    <AuthShell title="Welcome back," accent="let's keep planning">
      <h2 className="text-[28px] leading-tight font-bold tracking-tight">Log in</h2>
      <p className="mt-1 text-sm text-ink-2">Pick up where you left off.</p>
      <Suspense fallback={null}>
        <IdleNotice />
      </Suspense>
      <SignInForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="font-semibold text-gold-text underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-6 text-center text-sm text-ink-2">
        New here?{" "}
        <Link href="/sign-up" className="font-semibold text-gold-text underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
