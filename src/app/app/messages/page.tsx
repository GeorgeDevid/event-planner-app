"use client";

import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { BOOKING_STATUS, INQUIRY_STATUS } from "@/components/messaging/conversation";
import { PageHeader, Segmented } from "@/components/ui/kit";
import { formatCents, formatIsoDate } from "@/lib/format";

/** C-13 conversations and C-14 booking statuses. */
export default function ClientMessages() {
  const [tab, setTab] = useState<"messages" | "bookings">("messages");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" />
      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: "messages", label: "Conversations" },
          { value: "bookings", label: "Bookings" },
        ]}
      />
      {tab === "messages" ? <Conversations /> : <Bookings />}
    </div>
  );
}

function Conversations() {
  const rows = useQuery(api.inquiries.mine);
  if (rows === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">No messages yet</p>
        <p className="mt-1 text-sm text-ink-2">Open a vendor&apos;s profile and tap Message to ask about your event.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r._id}>
          <Link href={`/app/messages/${r._id}`} className="press-soft flex items-center gap-3 rounded-[20px] bg-surface p-3 shadow-card">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-dusk">
              {r.coverUrl ? <Image src={r.coverUrl} alt="" fill sizes="56px" className="object-cover" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-[15px] ${r.unread > 0 ? "font-bold" : "font-semibold"}`}>{r.vendorName}</span>
                <span className="shrink-0 text-xs text-ink-2">{INQUIRY_STATUS[r.status]}</span>
              </span>
              <span className="block truncate text-xs text-gold-text">{[r.eventName, r.category].filter(Boolean).join(" · ")}</span>
              <span className={`block truncate text-sm ${r.unread > 0 ? "text-ink" : "text-ink-2"}`}>{r.lastMessage}</span>
            </span>
            {r.unread > 0 ? (
              <span className="flex min-w-6 items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">
                {r.unread}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Bookings() {
  const rows = useQuery(api.bookings.mine);
  if (rows === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">No bookings yet</p>
        <p className="mt-1 text-sm text-ink-2">Booking requests you send will show here with their status.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((b) => (
        <li key={b._id}>
          <Link href={b.inquiryId ? `/app/messages/${b.inquiryId}` : "/app/messages"} className="press-soft flex items-center justify-between gap-3 rounded-[20px] bg-surface p-4 shadow-card">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{b.vendorName}</span>
              <span className="block text-sm text-ink-2">
                {formatIsoDate(b.serviceDate)}
                {b.eventName ? ` · ${b.eventName}` : ""}
              </span>
              {b.agreedPriceCents ? <span className="block text-sm text-ink-2">{formatCents(b.agreedPriceCents)}</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">{BOOKING_STATUS[b.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
