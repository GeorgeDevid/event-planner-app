import type { Metadata } from "next";
import { LegalPage } from "@/components/content/legal-page";
import { PublicShell } from "@/components/content/public-shell";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy">
      <LegalPage kind="privacy" />
    </PublicShell>
  );
}
