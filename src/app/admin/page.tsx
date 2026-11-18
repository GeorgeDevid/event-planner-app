"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useMe } from "@/components/shell/role-gate";

function Tile({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: number | undefined;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-[20px] p-5 shadow-card ${
        featured ? "bg-navy-900 text-white" : "bg-surface"
      }`}
    >
      <p className={`text-sm font-medium ${featured ? "text-on-navy-2" : "text-ink-2"}`}>{label}</p>
      <p className={`text-[34px] leading-none font-bold ${featured ? "text-gold-300" : ""}`}>
        {value ?? "–"}
      </p>
    </div>
  );
}

/** Admin dashboard (A-02), first cut: live totals from Convex. */
export default function AdminDashboard() {
  const me = useMe();
  const canViewStats = me.permissions.includes("users:view");
  const stats = useQuery(api.admin.dashboardStats, canViewStats ? {} : "skip");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <p className="text-sm text-ink-2">Good to see you, {me.name}</p>
        <h1 className="text-[28px] font-bold tracking-tight">
          Marketplace <span className="text-gold-display">overview</span>
        </h1>
      </header>

      {canViewStats ? (
        <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <Tile label="Pending vendor approvals" value={stats?.pendingVendorApprovals} featured />
          <Tile label="Clients" value={stats ? (stats.usersByRole.client ?? 0) : undefined} />
          <Tile label="Vendors" value={stats ? (stats.usersByRole.vendor ?? 0) : undefined} />
          <Tile
            label="Approved vendors"
            value={stats ? (stats.vendorsByStatus.approved ?? 0) : undefined}
          />
        </section>
      ) : (
        <p className="rounded-[20px] bg-surface p-5 text-sm text-ink-2 shadow-card">
          Your role doesn&apos;t include the dashboard totals.
        </p>
      )}

      <p className="rounded-[20px] bg-surface-2 p-4 text-sm text-ink-2">
        Vendor approvals, users, categories, event types, moderation and the audit log arrive in
        the next build steps.
      </p>
    </div>
  );
}
