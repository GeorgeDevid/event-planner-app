import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthShell title="Every celebration," accent="beautifully planned">
      <h2 className="text-[28px] leading-tight font-bold tracking-tight">Create your account</h2>
      <p className="mt-1 text-sm text-ink-2">
        Plan an event, or list your business as a vendor.
      </p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-gold-text underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
