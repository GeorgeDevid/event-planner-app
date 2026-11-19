"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Stars } from "@/components/ui/stars";

export type Testimonial = { _id: string; name: string; detail: string | null; quote: string; rating: number };

export function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col gap-4 rounded-[24px] bg-surface p-6 shadow-card">
      <Stars value={t.rating} size={18} />
      <blockquote className="flex-1 font-display text-[22px] leading-snug text-ink">
        <span aria-hidden="true" className="mr-1 text-gold-display">“</span>
        {t.quote}
        <span aria-hidden="true" className="ml-0.5 text-gold-display">”</span>
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-gold-300">
          {t.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("")}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{t.name}</span>
          {t.detail ? <span className="text-[13px] text-ink-2">{t.detail}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

/** Landing page "What people say": published app reviews in admin order. Hidden when there are none. */
export function LandingTestimonials() {
  const items = useQuery(api.content.publishedTestimonials);
  if (!items || items.length === 0) return null;
  return (
    <section aria-labelledby="reviews" className="bg-surface-2/60 px-5 py-16 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-gold-text uppercase">Reviews</p>
        <h2 id="reviews" className="mt-2 font-display text-[34px] leading-tight font-bold sm:text-[44px]">
          What people say about us
        </h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t._id}>
              <TestimonialCard t={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
