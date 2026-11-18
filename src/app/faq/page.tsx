import type { Metadata } from "next";
import { FaqList } from "@/components/content/faq-list";
import { PublicShell } from "@/components/content/public-shell";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default function FaqPage() {
  return (
    <PublicShell title="Frequently asked questions">
      <FaqList />
    </PublicShell>
  );
}
