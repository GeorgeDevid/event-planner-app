"use client";

import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { VendorStatusPill } from "@/components/ui/status-pill";

/** Vendor dashboard (V-08), first cut: approval status and what to do next. */
export default function VendorDashboard() {
  const me = useMe();
  const vendor = me.vendor;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900"
        >
          {(vendor?.companyName ?? "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1">
          <p className="text-xs text-ink-2">Welcome,</p>
          <p className="text-[15px] font-bold">{vendor?.companyName}</p>
        </div>
        <SignOutButton className="bg-surface text-navy-900 shadow-card" />
      </header>

      <h1 className="text-[28px] leading-[34px] font-bold tracking-tight">
        Your business
        <br />
        <span className="text-gold-display">at a glance</span>
      </h1>

      <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">Approval</h2>
          {vendor ? <VendorStatusPill status={vendor.status} /> : null}
        </div>
        {vendor?.status === "pending" ? (
          <p className="text-sm text-ink-2">
            We&apos;re reviewing your business. You won&apos;t appear in client searches until
            it&apos;s approved. Meanwhile, you&apos;ll be able to add your location, portfolio
            and packages here.
          </p>
        ) : vendor?.status === "approved" ? (
          <p className="text-sm text-ink-2">You&apos;re live. Clients nearby can find you.</p>
        ) : (
          <p className="text-sm text-ink-2">
            Your business isn&apos;t visible to clients right now. Contact support for details.
          </p>
        )}
      </section>

      <p className="rounded-[20px] bg-surface-2 p-4 text-sm text-ink-2">
        Location, portfolio, packages, calendar and inquiries arrive in the next build steps.
      </p>
    </div>
  );
}
