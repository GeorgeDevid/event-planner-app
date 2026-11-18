"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { BOOKING_STATUS, INQUIRY_STATUS } from "@/components/messaging/conversation";
import { PageHeader, Segmented } from "@/components/ui/kit";
import { formatCents, formatIsoDate } from "@/lib/format";

/** V-06 inquiry inbox and V-07 booking requests. */
export default function VendorInbox() {
  const [tab, setTab] = useState<"inquiries" | "bookings">("inquiries");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inquiries" backHref="/vendor" />
      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: "inquiries", label: "Inquiries" },
          { value: "bookings", label: "Bookings" },
        ]}
      />
      {tab === "inquiries" ? <Inquiries /> : <Bookings />}
    </div>
  );
}

function Inquiries() {
  const rows = useQuery(api.inquiries.forVendor);
  if (rows === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">No inquiries yet</p>
        <p className="mt-1 text-sm text-ink-2">When clients contact you, their messages appear here.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r._id}>
          <Link href={`/vendor/inquiries/${r._id}`} className={`flex items-start gap-3 rounded-[20px] p-4 shadow-card ${r.unread > 0 ? "bg-surface ring-2 ring-gold-500/60" : "bg-surface"}`}>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-[15px] ${r.unread > 0 ? "font-bold" : "font-semibold"}`}>
                  {r.clientName}
                  {r.unread > 0 ? <span className="sr-only"> ({r.unread} unread)</span> : null}
                </span>
                <span className="shrink-0 text-xs font-semibold text-gold-text">{INQUIRY_STATUS[r.status]}</span>
              </span>
              <span className="block text-xs text-ink-2">
                {[r.eventType, r.date ? formatIsoDate(r.date, { weekday: false }) : null, r.guestCount ? `${r.guestCount} guests` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className={`mt-1 block truncate text-sm ${r.unread > 0 ? "text-ink" : "text-ink-2"}`}>{r.lastMessage}</span>
            </span>
            {r.unread > 0 ? (
              <span aria-hidden="true" className="flex min-w-6 items-center justify-center rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">{r.unread}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Bookings() {
  const rows = useQuery(api.bookings.forVendor);
  if (rows === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  const groups = [
    { title: "Requests to answer", items: rows.filter((b) => b.status === "pending") },
    { title: "Upcoming", items: rows.filter((b) => b.status === "accepted" && !b.past) },
    { title: "Ready to complete", items: rows.filter((b) => b.status === "accepted" && b.past) },
    { title: "Past and closed", items: rows.filter((b) => ["completed", "declined", "cancelled"].includes(b.status)).reverse() },
  ];
  if (rows.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">No booking requests yet</p>
        <p className="mt-1 text-sm text-ink-2">Requests from clients show here. Payment is settled directly with the client.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-2">Payment is settled directly with the client. The app doesn&apos;t process payments.</p>
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.title} className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">{g.title}</h2>
            <ul className="flex flex-col gap-2">
              {g.items.map((b) => (
                <li key={b._id}>
                  <Link href={b.inquiryId ? `/vendor/inquiries/${b.inquiryId}` : "/vendor/inquiries"} className="flex items-center justify-between gap-3 rounded-[20px] bg-surface p-4 shadow-card">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{b.clientName}</span>
                      <span className="block text-sm text-ink-2">
                        {formatIsoDate(b.serviceDate)}
                        {b.eventType ? ` · ${b.eventType}` : ""}
                        {b.guestCount ? ` · ${b.guestCount} guests` : ""}
                      </span>
                      {b.packageName || b.agreedPriceCents ? (
                        <span className="block text-sm text-ink-2">
                          {[b.packageName, b.agreedPriceCents ? formatCents(b.agreedPriceCents) : null].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">{BOOKING_STATUS[b.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
