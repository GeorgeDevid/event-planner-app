"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function FaqItems({ items }: { items: { _id: string; question: string; answer: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((f) => (
        <details key={f._id} className="group rounded-[20px] bg-surface p-5 shadow-card">
          <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
            {f.question}
            <span aria-hidden="true" className="text-gold-text transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-[15px] whitespace-pre-line text-ink-2">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function FaqList() {
  const faqs = useQuery(api.content.publishedFaqs);
  if (faqs === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (faqs.length === 0) return <p className="text-[15px] text-ink-2">No questions have been published yet.</p>;
  return <FaqItems items={faqs} />;
}
