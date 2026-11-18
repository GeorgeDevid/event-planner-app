"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import {
  AdminHeader,
  EmptyRow,
  FilterSelect,
  formatDateTime,
  SearchInput,
  TableCard,
  td,
  th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

type Module = "users" | "vendors" | "categories" | "roles";

function describe(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

/** A-11: read-only audit log with filters and CSV export. */
export default function AdminAuditLog() {
  const [module, setModule] = useState<Module | "">("");
  const [action, setAction] = useState("");
  const data = useQuery(api.adminAudit.list, {
    module: module || undefined,
    action: action || undefined,
    limit: 200,
  });

  function exportCsv() {
    if (!data) return;
    const header = ["When", "Actor", "Role", "Action", "Module", "Target", "Before", "After"];
    const lines = data.rows.map((r) =>
      [formatDateTime(r.at), r.actor, r.actorRole ?? "", r.action, r.module, r.target ?? "", describe(r.before), describe(r.after)]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminHeader
        title="Audit"
        accent="log"
        description="Every sensitive change, newest first. Entries can't be edited or deleted."
        actions={<Button type="button" variant="secondary" onClick={exportCsv} disabled={!data?.rows.length}>Export CSV</Button>}
      />
      <div className="flex flex-wrap gap-2">
        <SearchInput value={action} onChange={setAction} label="Filter by action, e.g. suspended" />
        <FilterSelect label="Module" value={module} onChange={setModule} options={[{ value: "vendors", label: "Vendors" }, { value: "users", label: "Users" }, { value: "categories", label: "Categories" }, { value: "roles", label: "Roles" }]} />
      </div>

      <TableCard caption="Audit log">
        <thead>
          <tr>
            <th scope="col" className={th}>When</th>
            <th scope="col" className={th}>Who</th>
            <th scope="col" className={th}>Action</th>
            <th scope="col" className={th}>Target</th>
            <th scope="col" className={th}>Change</th>
          </tr>
        </thead>
        <tbody>
          {data === undefined ? (
            <EmptyRow colSpan={5}>Loading…</EmptyRow>
          ) : data.rows.length === 0 ? (
            <EmptyRow colSpan={5}>No entries match.</EmptyRow>
          ) : (
            data.rows.map((r) => (
              <tr key={r._id}>
                <td className={`${td} whitespace-nowrap text-ink-2`}>{formatDateTime(r.at)}</td>
                <td className={td}>
                  <p className="font-semibold">{r.actor}</p>
                  {r.actorRole ? <p className="text-xs text-ink-2">{r.actorRole.replace("_", " ")}</p> : null}
                </td>
                <td className={td}><code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{r.action}</code></td>
                <td className={td}>{r.target ?? "—"}</td>
                <td className={`${td} max-w-xs text-xs text-ink-2`}>
                  {r.before ? <p>Before: {describe(r.before)}</p> : null}
                  {r.after ? <p>After: {describe(r.after)}</p> : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
      {data && data.total > data.rows.length ? (
        <p className="text-sm text-ink-2">Showing the newest {data.rows.length} of {data.total} matching entries.</p>
      ) : null}
    </div>
  );
}
