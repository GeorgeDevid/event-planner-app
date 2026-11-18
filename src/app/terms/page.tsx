import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";
import { PublicShell } from "@/components/content/public-shell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <PublicShell title="Terms of Service">
      <LegalPage kind="terms" />
    </PublicShell>
  );
}
