"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Image from "next/image";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminHeader, Drawer, EmptyRow, formatDateTime, TableCard, Tabs, td, th, timeAgo } from "@/components/admin/ui";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { TextArea } from "@/components/ui/kit";
import { StatusPill, VendorStatusPill } from "@/components/ui/status-pill";
import { errorMessage } from "@/lib/errors";
import { formatCents } from "@/lib/format";

type Status = "open" | "in_review" | "resolved";
type Detail = NonNullable<FunctionReturnType<typeof api.reports.detail>>;
type Action = "dismiss" | "remove_message" | "warn_user" | "suspend_vendor" | "suspend_user";

const STATUS_LABEL: Record<Status, string> = { open: "Open", in_review: "In review", resolved: "Resolved" };
const ACTION_LABEL: Record<Action, string> = {
  dismiss: "Dismiss (no action needed)",
  remove_message: "Remove a message",
  warn_user: "Warn someone",
  suspend_vendor: "Suspend the vendor",
  suspend_user: "Suspend a user account",
};

/** A-08: queue of reported vendors and conversations. */
export default function Moderation() {
  const [status, setStatus] = useState<Status>("open");
  const [openId, setOpenId] = useState<Id<"reports"> | null>(null);
  const counts = useQuery(api.reports.counts);
  const rows = useQuery(api.reports.list, { status });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader title="Moderation" accent="queue" description="Reports from clients and vendors. Resolving one tells the reporter it was reviewed." />
      <Tabs
        label="Report status"
        value={status}
        onChange={setStatus}
        tabs={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s], count: counts?.[s] ?? 0 }))}
      />
      <TableCard caption="Reports">
        <thead>
          <tr>
            <th scope="col" className={th}>Reported</th>
            <th scope="col" className={th}>Reason</th>
            <th scope="col" className={th}>Reporter</th>
            <th scope="col" className={th}>When</th>
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            <EmptyRow colSpan={5}>Loading…</EmptyRow>
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={5}>{status === "open" ? "Nothing waiting. Nice." : "No reports here."}</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r._id} className="hover:bg-[#faf7f2]">
                <td className={td}>
                  <p className="font-semibold">{r.target}</p>
                  <p className="text-xs text-ink-2">{r.targetType === "vendor" ? "Vendor" : "Conversation"}</p>
                </td>
                <td className={td}>{r.reason}</td>
                <td className={`${td} text-ink-2`}>{r.reporter}</td>
                <td className={`${td} text-ink-2`}>{timeAgo(r.createdAt)}</td>
                <td className={`${td} text-right`}>
                  <Button type="button" variant={status === "resolved" ? "secondary" : "navy"} className="min-h-10 px-4 text-sm" onClick={() => setOpenId(r._id)}>
                    {status === "resolved" ? "Open" : "Review"}
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title="Report">
        {openId ? <ReportDetail reportId={openId} onDone={() => setOpenId(null)} /> : null}
      </Drawer>
    </div>
  );
}

function ReportDetail({ reportId, onDone }: { reportId: Id<"reports">; onDone: () => void }) {
  const me = useMe();
  const report = useQuery(api.reports.detail, { reportId });
  const setInReview = useMutation(api.reports.setInReview);
  const [error, setError] = useState<string | null>(null);
  const can = (p: string) => me.permissions.includes(p as never);

  if (report === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (report === null) return <p className="text-sm text-ink-2">Report not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gold-text">{report.targetType === "vendor" ? "Reported vendor" : "Reported conversation"}</p>
          <h3 className="text-[20px] font-bold">{report.reason}</h3>
          <p className="text-sm text-ink-2">
            By {report.reporter.name} ({report.reporter.role}) · {formatDateTime(report.createdAt)}
          </p>
        </div>
        <StatusPill tone={report.status === "resolved" ? "success" : report.status === "in_review" ? "info" : "pending"}>
          {STATUS_LABEL[report.status]}
        </StatusPill>
      </div>
      {report.details ? <p className="rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-line">{report.details}</p> : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      {report.vendor ? (
        <section className="flex flex-col gap-1 rounded-2xl border border-line p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{report.vendor.companyName}</p>
            <VendorStatusPill status={report.vendor.status} />
          </div>
          <p className="text-ink-2">
            Owner: {report.vendor.owner.name}
            {report.vendor.owner.status === "suspended" ? " (suspended)" : ""}
          </p>
        </section>
      ) : null}

      {report.conversation ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-bold">Conversation</h4>
          <ol className="flex max-h-[360px] flex-col gap-2 overflow-y-auto rounded-2xl bg-surface-2 p-3">
            {report.conversation.messages.map((m) => (
              <li key={m._id} className="rounded-xl bg-surface p-3 text-sm">
                <p className="text-xs font-semibold text-ink-2">
                  {m.from === "client" ? report.conversation!.client.name : m.from === "vendor" ? report.vendor?.companyName : "System"} ·{" "}
                  {formatDateTime(m.createdAt)}
                  {m.removed ? " · removed" : ""}
                </p>
                {m.quote ? <p className="font-semibold">Quote: {formatCents(m.quote.priceCents)}</p> : null}
                {m.body ? <p className={`whitespace-pre-line ${m.removed ? "text-ink-2 line-through" : ""}`}>{m.body}</p> : null}
                {m.images.length > 0 ? (
                  <div className="mt-2 flex gap-1.5">
                    {m.images.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="relative block size-16 overflow-hidden rounded-lg">
                        <Image src={url} alt="Attached photo" fill sizes="64px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : report.targetType === "conversation" ? (
        <p className="text-sm text-ink-2">You don&apos;t have permission to read messages.</p>
      ) : null}

      {report.status === "resolved" ? (
        <section className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold">Resolved: {ACTION_LABEL[(report.action ?? "dismiss") as Action]}</p>
          <p className="mt-1 whitespace-pre-line">{report.resolution}</p>
          <p className="mt-1 text-xs text-ink-2">
            {report.resolvedBy ? `By ${report.resolvedBy}` : ""}
            {report.resolvedAt ? ` · ${formatDateTime(report.resolvedAt)}` : ""}
          </p>
        </section>
      ) : can("reports:edit") ? (
        <>
          {report.status === "open" ? (
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              onClick={() => setInReview({ reportId }).catch((e) => setError(errorMessage(e)))}
            >
              Mark as in review
            </Button>
          ) : null}
          <ResolveForm report={report} can={can} onDone={onDone} />
        </>
      ) : null}
    </div>
  );
}

function ResolveForm({ report, can, onDone }: { report: Detail; can: (p: string) => boolean; onDone: () => void }) {
  const resolve = useMutation(api.reports.resolve);
  const [action, setAction] = useState<Action>("dismiss");
  const [messageId, setMessageId] = useState("");
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const people = [
    report.vendor ? { _id: report.vendor.owner._id, label: `${report.vendor.owner.name} (vendor owner)` } : null,
    report.conversation ? { _id: report.conversation.client._id, label: `${report.conversation.client.name} (client)` } : null,
  ].filter((p): p is { _id: Id<"users">; label: string } => !!p);

  const actions: Action[] = ["dismiss", "warn_user"];
  if (report.conversation) actions.splice(1, 0, "remove_message");
  if (can("vendors:suspend") && report.vendor && (report.vendor.status === "approved" || report.vendor.status === "pending")) actions.push("suspend_vendor");
  if (can("users:suspend")) actions.push("suspend_user");

  return (
    <form
      className="flex flex-col gap-4 border-t border-line pt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await resolve({
            reportId: report._id,
            action,
            note,
            messageId: action === "remove_message" ? ((messageId || undefined) as Id<"messages"> | undefined) : undefined,
            userId: action === "warn_user" || action === "suspend_user" ? ((userId || people[0]?._id) as Id<"users"> | undefined) : undefined,
          });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <h4 className="text-[15px] font-bold">Resolve</h4>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Action</legend>
        {actions.map((a) => (
          <label key={a} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-surface-2 px-4 text-sm font-semibold has-[:checked]:bg-navy-900 has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text">
            <input type="radio" name="action" className="sr-only" checked={action === a} onChange={() => setAction(a)} />
            {ACTION_LABEL[a]}
          </label>
        ))}
      </fieldset>
      {action === "remove_message" && report.conversation ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Message to remove</span>
          <select value={messageId} onChange={(e) => setMessageId(e.target.value)} className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-sm">
            <option value="">Choose a message</option>
            {report.conversation.messages
              .filter((m) => m.from !== "system" && !m.removed)
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {(m.from === "client" ? "Client: " : "Vendor: ") + (m.body || (m.images.length ? "Photo" : m.quote ? "Quote" : "")).slice(0, 60)}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {(action === "warn_user" || action === "suspend_user") && people.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Who</span>
          <select value={userId || people[0]._id} onChange={(e) => setUserId(e.target.value)} className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-sm">
            {people.map((p) => (
              <option key={p._id} value={p._id}>{p.label}</option>
            ))}
          </select>
        </label>
      ) : null}
      <TextArea
        id="resolution"
        label={action === "warn_user" ? "Resolution note (sent to them as the warning)" : "Resolution note"}
        helper="Required. Saved with the report and in the audit log."
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" variant={action === "suspend_user" || action === "suspend_vendor" ? "danger" : "navy"} disabled={pending || note.trim().length < 5}>
        {pending ? "Saving…" : "Resolve report"}
      </Button>
    </form>
  );
}
