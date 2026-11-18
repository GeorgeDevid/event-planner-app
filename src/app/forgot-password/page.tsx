import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Locked out?" accent="we'll get you back in">
      <h2 className="text-[28px] leading-tight font-bold tracking-tight">Reset your password</h2>
      <p className="mt-1 text-sm text-ink-2">Enter your account email and we&apos;ll send you a link.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-2">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-gold-text underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
