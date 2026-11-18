import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Almost there," accent="choose a new password">
      <h2 className="text-[28px] leading-tight font-bold tracking-tight">New password</h2>
      <p className="mt-1 text-sm text-ink-2">Use at least 10 characters. You&apos;ll be logged out on other devices.</p>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
