"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LegalText } from "@/components/content/legal-text";

export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const doc = useQuery(api.content.legal, { kind });
  if (doc === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (doc === null) return <p className="text-[15px] text-ink-2">This page hasn&apos;t been published yet.</p>;
  return (
    <>
      <p className="mb-6 text-sm text-ink-2">
        Version {doc.version} · Last updated{" "}
        {new Date(doc.publishedAt).toLocaleDateString("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric" })}
      </p>
      <LegalText body={doc.body} />
    </>
  );
}
