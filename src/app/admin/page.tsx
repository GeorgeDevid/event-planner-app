"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { useMe } from "@/components/shell/role-gate";

function Tile({ label, value, featured = false }: { label: string; value: number | undefined; featured?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 rounded-[20px] p-5 shadow-card ${featured ? "bg-navy-900 text-white" : "bg-surface"}`}>
      <p className={`text-sm font-medium ${featured ? "text-on-navy-2" : "text-ink-2"}`}>{label}</p>
      <p className={`text-[34px] leading-none font-bold ${featured ? "text-gold-300" : ""}`}>{value ?? "–"}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <section className="rounded-[20px] bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {rows.map(([label, n]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
            <dt className="text-ink-2">{label}</dt>
            <dd className="font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const pick = (m: Record<string, number> | null | undefined, keys: [string, string][]) =>
  keys.map(([k, label]) => [label, m?.[k] ?? 0] as [string, number]);

/** A-02: totals and what needs attention, limited to what this admin may see. */
export default function AdminDashboard() {
  const me = useMe();
  const s = useQuery(api.admin.dashboardStats);
  const todo = [
    s?.todo.pendingVendors != null ? { label: "Vendors waiting for approval", n: s.todo.pendingVendors, href: "/admin/vendors" } : null,
    s?.todo.openReports != null ? { label: "Open reports", n: s.todo.openReports, href: "/admin/moderation" } : null,
    s?.todo.pendingBookings != null ? { label: "Booking requests awaiting vendors", n: s.todo.pendingBookings, href: "/admin/bookings?tab=bookings&status=pending" } : null,
  ].filter((x): x is { label: string; n: number; href: string } => !!x);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <p className="text-sm text-ink-2">Good to see you, {me.name}</p>
        <h1 className="text-[28px] font-bold tracking-tight">
          Marketplace <span className="text-gold-display">overview</span>
        </h1>
      </header>

      {todo.length > 0 ? (
        <section aria-labelledby="todo" className="flex flex-col gap-3">
          <h2 id="todo" className="text-[17px] font-bold">Needs attention</h2>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {todo.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className={`flex items-center justify-between gap-3 rounded-[20px] p-5 shadow-card ${t.n > 0 ? "bg-navy-900 text-white" : "bg-surface"}`}>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className={`text-[28px] leading-none font-bold ${t.n > 0 ? "text-gold-300" : ""}`}>{t.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {s?.users ? <Tile label="Clients" value={s.users.client ?? 0} /> : null}
        {s?.vendorsByStatus ? <Tile label="Approved vendors" value={s.vendorsByStatus.approved ?? 0} /> : null}
        {s?.events ? <Tile label="Upcoming events" value={s.events.upcoming} /> : null}
        {s?.bookingsByStatus ? <Tile label="Accepted bookings" value={s.bookingsByStatus.accepted ?? 0} featured /> : null}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {s?.vendorsByStatus ? (
          <Breakdown
            title="Vendors by status"
            rows={pick(s.vendorsByStatus, [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Changes requested"], ["draft", "In setup"], ["suspended", "Suspended"], ["deactivated", "Deactivated"]])}
          />
        ) : null}
        {s?.users ? <Breakdown title="Accounts" rows={pick(s.users, [["client", "Clients"], ["vendor", "Vendors"], ["admin", "Admins"]])} /> : null}
        {s?.events ? <Breakdown title="Events" rows={pick(s.events.byStatus, [["active", "Active"], ["draft", "Drafts"], ["cancelled", "Cancelled"]])} /> : null}
        {s?.inquiriesByStatus ? (
          <Breakdown title="Inquiries" rows={pick(s.inquiriesByStatus, [["sent", "Sent"], ["quoted", "Quoted"], ["declined", "Declined"], ["closed", "Closed"]])} />
        ) : null}
        {s?.bookingsByStatus ? (
          <Breakdown
            title="Bookings"
            rows={pick(s.bookingsByStatus, [["pending", "Pending"], ["accepted", "Accepted"], ["completed", "Completed"], ["declined", "Declined"], ["cancelled", "Cancelled"]])}
          />
        ) : null}
      </div>
      {s === undefined ? <p className="text-sm text-ink-2">Loading…</p> : null}
    </div>
  );
}
