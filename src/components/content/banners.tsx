"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";

export type BannerData = {
  _id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  imageUrl: string | null;
};

/** One homepage banner card; also used for the admin preview. */
export function BannerCard({ banner }: { banner: BannerData }) {
  const external = banner.linkUrl?.startsWith("http");
  return (
    <article className="relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-[24px] bg-dusk p-5 text-white shadow-card">
      {banner.imageUrl ? <Image src={banner.imageUrl} alt="" fill sizes="448px" className="object-cover" /> : null}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-navy-900/10 to-navy-900/80" />
      <h2 className="relative font-display text-[24px] leading-tight font-bold">{banner.title}</h2>
      {banner.body ? <p className="relative mt-1 text-sm">{banner.body}</p> : null}
      {banner.linkUrl && banner.linkLabel ? (
        external ? (
          <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="relative mt-3 inline-flex w-fit min-h-10 items-center rounded-full bg-gold-300 px-4 text-sm font-semibold text-navy-900">
            {banner.linkLabel}
          </a>
        ) : (
          <Link href={banner.linkUrl} className="relative mt-3 inline-flex w-fit min-h-10 items-center rounded-full bg-gold-300 px-4 text-sm font-semibold text-navy-900">
            {banner.linkLabel}
          </Link>
        )
      ) : null}
    </article>
  );
}

/** Live banners for the client home (A-09 #1). */
export function HomeBanners() {
  const banners = useQuery(api.content.activeBanners);
  if (!banners || banners.length === 0) return null;
  return (
    <section aria-label="Announcements" className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
      {banners.map((b) => (
        <div key={b._id} className="w-[88%] shrink-0 snap-start">
          <BannerCard banner={b} />
        </div>
      ))}
    </section>
  );
}
