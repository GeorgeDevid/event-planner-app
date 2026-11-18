"use client";

import type { FunctionReturnType } from "convex/server";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { PhotoPlaceholder } from "@/components/ui/kit";
import { formatCents, formatPrice } from "@/lib/format";

export type PublicProfile = NonNullable<FunctionReturnType<typeof api.vendors.publicProfile>>;

/**
 * The vendor profile as clients see it (C-10). Used for the vendor's own
 * preview now and for the client app later. Actions are passed in.
 */
export function VendorProfileView({
  profile,
  topLeft,
  actions,
  actionsBottom = "bottom-3",
}: {
  profile: PublicProfile;
  topLeft?: ReactNode;
  actions?: ReactNode;
  /** Lift the action bar above a bottom tab bar when there is one. */
  actionsBottom?: "bottom-3" | "bottom-24";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const photos = profile.images.filter((u): u is string => !!u);
  return (
    <article className="flex flex-col pb-32">
      <div className="relative h-[340px] overflow-hidden rounded-b-[28px]">
        {profile.coverUrl ? (
          <Image src={profile.coverUrl} alt="" fill priority sizes="448px" className="object-cover" />
        ) : (
          <PhotoPlaceholder label="Cover photo" className="absolute inset-0" />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-navy-900/10 via-transparent to-navy-900/80" />
        <div className="absolute inset-x-4 top-4 flex justify-between">{topLeft}</div>
        <div className="absolute inset-x-5 bottom-10">
          <p className="text-xs font-semibold text-gold-300">{profile.categories.join(" · ")}</p>
          <h1 className="font-display text-[36px] leading-[1.05] font-bold text-white">{profile.companyName}</h1>
          {profile.verified ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
              Verified
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative -mt-6 mx-4 grid grid-cols-3 gap-2 rounded-[20px] bg-surface p-4 text-center shadow-card">
        <Fact label="Average price" value={profile.avgPriceCents ? formatCents(profile.avgPriceCents) : "On request"} />
        <Fact label="Packages" value={String(profile.packages.length)} />
        <Fact label={profile.clientsComeToMe ? "Visit them" : "Travels"} value={profile.clientsComeToMe ? "In studio" : "To you"} />
      </div>

      <div className="flex flex-col gap-7 px-5 pt-7">
        <section>
          <h2 className="text-[17px] font-bold">About</h2>
          <p className="mt-1 text-sm text-ink-2">Run by {profile.ownerName}</p>
          <p className="mt-3 text-[15px] whitespace-pre-line">
            {profile.about ?? "This vendor hasn't added a description yet."}
          </p>
          {profile.serviceArea ? (
            <p className="mt-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">Service area: </span>
              {profile.serviceArea}
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-[17px] font-bold">Portfolio</h2>
          {profile.images.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {profile.images.map((url, i) =>
                url ? (
                  <li key={url} className="relative aspect-square overflow-hidden rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      aria-label={`Open photo ${i + 1} of ${profile.images.length}`}
                      className="absolute inset-0"
                    >
                      <Image src={url} alt="" fill sizes="140px" className="object-cover" />
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">No photos yet.</p>
          )}
        </section>

        <section>
          <h2 className="text-[17px] font-bold">Packages</h2>
          {profile.packages.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3">
              {profile.packages.map((p) => (
                <li key={p._id} className="rounded-[20px] bg-surface p-4 shadow-card">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[15px] font-semibold">{p.name}</h3>
                    <p className="shrink-0 text-sm font-bold">{formatPrice(p)}</p>
                  </div>
                  {p.description ? <p className="mt-1 text-sm text-ink-2 whitespace-pre-line">{p.description}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">Price on request.</p>
          )}
        </section>
      </div>

      {openIndex !== null ? (
        <Lightbox photos={photos} start={openIndex} title={profile.companyName} onClose={() => setOpenIndex(null)} />
      ) : null}

      {actions ? (
        <div className={`fixed inset-x-3 ${actionsBottom} z-20 mx-auto flex max-w-md items-center gap-3 rounded-[24px] bg-navy-900 p-3 pl-5 text-white shadow-float`}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[15px] font-bold">{value}</p>
      <p className="text-xs text-ink-2">{label}</p>
    </div>
  );
}

/** Full-screen gallery: arrow buttons, arrow keys and swipe (C-10 #2). */
function Lightbox({
  photos,
  start,
  title,
  onClose,
}: {
  photos: string[];
  start: number;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const touchX = useRef<number | null>(null);
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const nav = "absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-900";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`${title} photos`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-navy-900 p-0 text-white backdrop:bg-navy-900"
    >
      <div
        className="relative h-full w-full"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <Image src={photos[index]} alt={`${title} photo ${index + 1}`} fill sizes="100vw" className="object-contain" />
        <p aria-live="polite" className="absolute top-5 left-5 rounded-full bg-navy-900/70 px-3 py-1 text-sm">
          {index + 1} / {photos.length}
        </p>
        <button type="button" onClick={onClose} aria-label="Close photos" className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-white/90 text-navy-900">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${nav} left-3`}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${nav} right-3`}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
