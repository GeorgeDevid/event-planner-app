"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminHeader, EmptyRow, FilterSelect, ReasonDialog, SearchInput, TableCard, Tabs, td, th } from "@/components/admin/ui";
import { useQueryState } from "@/components/client/vendor-results";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/components/ui/loader";
import { formatCents, formatIsoDate } from "@/lib/format";

type Tab = "events" | "inquiries" | "bookings";
const STATUS: Record<Tab, { value: string; label: string }[]> = {
  events: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "cancelled", label: "Cancelled" }],
  inquiries: [{ value: "sent", label: "Sent" }, { value: "quoted", label: "Quoted" }, { value: "declined", label: "Declined" }, { value: "closed", label: "Closed" }],
  bookings: [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "completed", label: "Completed" },
    { value: "declined", label: "Declined" },
    { value: "cancelled", label: "Cancelled" },
  ],
};
const label = (tab: Tab, s: string) => STATUS[tab].find((x) => x.value === s)?.label ?? s;

function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([[header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OversightPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Oversight />
    </Suspense>
  );
}

/** A-07: search events, inquiries and bookings; step in on bookings; export CSV. */
function Oversight() {
  const me = useMe();
  const [params, setParams] = useQueryState();
  const can = (p: string) => me.permissions.includes(p as never);
  const tabs = [
    can("events:view") ? { value: "events", label: "Events" } : null,
    can("events:view") ? { value: "inquiries", label: "Inquiries" } : null,
    can("bookings:view") ? { value: "bookings", label: "Bookings" } : null,
  ].filter(Boolean) as { value: Tab; label: string }[];
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = tabs.some((t) => t.value === requested) ? requested! : (tabs[0]?.value ?? "events");
  const f = {
    search: params.get("q") ?? "",
    status: params.get("status") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
  const args = { search: f.search || undefined, status: f.status || undefined, from: f.from || undefined, to: f.to || undefined };

  if (tabs.length === 0) return <p className="text-sm text-ink-2">Your role can&apos;t view events or bookings.</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader title="Events &" accent="bookings" description="Find any event, inquiry or booking. Up to 500 matches are shown; narrow the filters to see more." />
      <Tabs label="Show" value={tab} onChange={(t) => setParams({ tab: t, status: null })} tabs={tabs} />
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={f.search} onChange={(v) => setParams({ q: v || null })} label={tab === "events" ? "Search event or client" : "Search client or vendor"} />
        <FilterSelect label="Status" value={f.status} onChange={(v) => setParams({ status: v || null })} options={STATUS[tab]} />
        <label className="flex h-11 items-center gap-2 rounded-full border border-control bg-surface px-4 text-sm">
          <span className="text-ink-2">{tab === "inquiries" ? "Sent from" : "From"}</span>
          <input type="date" value={f.from} onChange={(e) => setParams({ from: e.target.value || null })} className="bg-transparent font-semibold" />
        </label>
        <label className="flex h-11 items-center gap-2 rounded-full border border-control bg-surface px-4 text-sm">
          <span className="text-ink-2">To</span>
          <input type="date" value={f.to} onChange={(e) => setParams({ to: e.target.value || null })} className="bg-transparent font-semibold" />
        </label>
      </div>
      {tab === "events" ? (
        <EventsTable args={args} />
      ) : tab === "inquiries" ? (
        <InquiriesTable args={args} canRead={can("messages:view")} />
      ) : (
        <BookingsTable args={args} canEdit={can("bookings:edit")} canRead={can("messages:view")} />
      )}
    </div>
  );
}

type Args = { search?: string; status?: string; from?: string; to?: string };

function EventsTable({ args }: { args: Args }) {
  const rows = useQuery(api.adminOversight.events, args);
  return (
    <>
      <ExportButton
        disabled={!rows?.length}
        onClick={() =>
          downloadCsv(
            "events",
            ["Event", "Type", "Client", "Email", "Date", "Location", "Guests", "Status", "Services", "Booked"],
            (rows ?? []).map((r) => [r.name, r.type, r.client, r.clientEmail, r.date, r.location, r.guests, r.status, r.services, r.booked]),
          )
        }
      />
      <TableCard caption="Events">
        <thead>
          <tr>{["Event", "Client", "Date", "Guests", "Booked", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={6}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6}>No events match.</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id}>
                <td className={td}><p className="font-semibold">{r.name}</p><p className="text-xs text-ink-2">{r.type}</p></td>
                <td className={td}><p>{r.client}</p><p className="text-xs text-ink-2">{r.clientEmail}</p></td>
                <td className={`${td} text-ink-2`}>{r.date ? formatIsoDate(r.date) : "—"}</td>
                <td className={`${td} text-ink-2`}>{r.guests ?? "—"}</td>
                <td className={`${td} text-ink-2`}>{r.booked} of {r.services}</td>
                <td className={td}>{label("events", r.status)}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </>
  );
}

function InquiriesTable({ args, canRead }: { args: Args; canRead: boolean }) {
  const rows = useQuery(api.adminOversight.inquiries, args);
  return (
    <>
      <ExportButton
        disabled={!rows?.length}
        onClick={() =>
          downloadCsv("inquiries", ["Client", "Vendor", "Service", "Event date", "Sent", "Status"], (rows ?? []).map((r) => [r.client, r.vendor, r.service, r.eventDate, r.sent, r.status]))
        }
      />
      <TableCard caption="Inquiries">
        <thead>
          <tr>
            {["Client", "Vendor", "Service", "Event date", "Sent", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={7}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={7}>No inquiries match.</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id}>
                <td className={td}>{r.client}</td>
                <td className={td}>{r.vendor}</td>
                <td className={`${td} text-ink-2`}>{r.service ?? "—"}</td>
                <td className={`${td} text-ink-2`}>{r.eventDate ? formatIsoDate(r.eventDate) : "—"}</td>
                <td className={`${td} text-ink-2`}>{formatIsoDate(r.sent)}</td>
                <td className={td}>{label("inquiries", r.status)}</td>
                <td className={`${td} text-right`}>
                  {canRead ? (
                    <Link href={`/admin/conversations/${r._id}`} className="text-sm font-semibold text-gold-text">
                      Read<span className="sr-only"> conversation between {r.client} and {r.vendor}</span>
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </>
  );
}

function BookingsTable({ args, canEdit, canRead }: { args: Args; canEdit: boolean; canRead: boolean }) {
  const rows = useQuery(api.adminOversight.bookings, args);
  const setStatus = useMutation(api.adminOversight.setBookingStatus);
  const [change, setChange] = useState<{ id: Id<"bookings">; to: "cancelled" | "completed"; who: string } | null>(null);
  return (
    <>
      <ExportButton
        disabled={!rows?.length}
        onClick={() =>
          downloadCsv(
            "bookings",
            ["Client", "Vendor", "Service date", "Package", "Agreed price", "Status", "Reason"],
            (rows ?? []).map((r) => [r.client, r.vendor, r.serviceDate, r.packageName, r.priceCents ? r.priceCents / 100 : null, r.status, r.reason]),
          )
        }
      />
      <TableCard caption="Bookings">
        <thead>
          <tr>
            {["Client", "Vendor", "Service date", "Price", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={6}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6}>No bookings match.</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id}>
                <td className={td}>{r.client}</td>
                <td className={td}>{r.vendor}</td>
                <td className={`${td} text-ink-2`}>{formatIsoDate(r.serviceDate)}</td>
                <td className={`${td} text-ink-2`}>{r.priceCents ? formatCents(r.priceCents) : "—"}</td>
                <td className={td}>
                  <p>{label("bookings", r.status)}</p>
                  {r.reason ? <p className="max-w-[220px] truncate text-xs text-ink-2" title={r.reason}>{r.reason}</p> : null}
                </td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  {canRead && r.inquiryId ? (
                    <Link href={`/admin/conversations/${r.inquiryId}`} className="mr-2 text-sm font-semibold text-gold-text">Thread</Link>
                  ) : null}
                  {canEdit && (r.status === "pending" || r.status === "accepted") ? (
                    <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => setChange({ id: r._id, to: "cancelled", who: `${r.client} and ${r.vendor}` })}>
                      Cancel
                    </Button>
                  ) : null}
                  {canEdit && r.status === "accepted" ? (
                    <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setChange({ id: r._id, to: "completed", who: `${r.client} and ${r.vendor}` })}>
                      Complete
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
      {change ? (
        <ReasonDialog
          open
          onClose={() => setChange(null)}
          title={change.to === "cancelled" ? "Cancel this booking?" : "Mark this booking completed?"}
          consequence={`${change.who} are both notified with your reason, and the change is written to the audit log.`}
          confirmLabel={change.to === "cancelled" ? "Cancel booking" : "Mark completed"}
          tone={change.to === "cancelled" ? "danger" : "navy"}
          reasonLabel="Reason (shared with both parties)"
          onConfirm={(reason) => setStatus({ bookingId: change.id, status: change.to, reason })}
        />
      ) : null}
    </>
  );
}

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button type="button" variant="secondary" className="self-end" onClick={onClick} disabled={disabled}>
      Export CSV
    </Button>
  );
}
