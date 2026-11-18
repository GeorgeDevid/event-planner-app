"use client";

import Link from "next/link";
import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ArrowBadge, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { VendorStatusPill } from "@/components/ui/status-pill";
import { useMyVendor } from "@/components/vendor/use-vendor";
import { formatCents } from "@/lib/format";

/** Vendor dashboard (V-08): approval status, setup checklist and shortcuts. */
export default function VendorDashboard() {
  const me = useMe();
  const vendor = useMyVendor();
  if (vendor === undefined) return <FullPageLoader />;

  const steps = [
    { done: vendor.checklist.details, label: "Business details", href: "/vendor/setup" },
    { done: vendor.checklist.categories, label: "Services you offer", href: "/vendor/setup" },
    { done: vendor.checklist.location, label: "Location and service radius", href: "/vendor/setup" },
    { done: vendor.checklist.packages, label: "At least one package with a price", href: "/vendor/packages" },
    { done: vendor.images.length > 0, label: "Portfolio photos", href: "/vendor/profile" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900"
        >
          {vendor.companyName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-2">Welcome back, {me.name?.split(" ")[0]}</p>
          <p className="truncate text-[15px] font-bold">{vendor.companyName}</p>
        </div>
        <SignOutButton className="bg-surface text-navy-900 shadow-card" />
      </header>

      <h1 className="text-[28px] leading-[34px] font-bold tracking-tight">
        Your business
        <br />
        <span className="text-gold-display">at a glance</span>
      </h1>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold">Approval</h2>
          <VendorStatusPill status={vendor.status} />
        </div>
        {vendor.status === "draft" ? (
          <>
            <p className="text-sm text-ink-2">
              Finish setting up your business and submit it for review. You&apos;ll appear in client
              searches once our team approves it.
            </p>
            <LinkButton href="/vendor/setup" variant={vendor.canSubmit ? "gold" : "navy"} className="mt-1 w-full">
              {vendor.canSubmit ? "Review and submit" : "Continue setup"}
            </LinkButton>
          </>
        ) : vendor.status === "pending" ? (
          <p className="text-sm text-ink-2">
            We&apos;re reviewing your business. This usually takes 1–2 business days. You won&apos;t
            appear in searches until it&apos;s approved, but you can keep adding photos and packages.
          </p>
        ) : vendor.status === "rejected" ? (
          <>
            <p className="text-sm text-ink-2">
              Our team asked for changes before approving your business:
            </p>
            <p className="rounded-2xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
              {vendor.rejectionReason ?? "See the email from our team."}
            </p>
            <LinkButton href="/vendor/setup" variant="navy" className="mt-1 w-full">
              Make changes and resubmit
            </LinkButton>
          </>
        ) : vendor.status === "approved" ? (
          <p className="text-sm text-ink-2">You&apos;re live. Clients nearby can find you.</p>
        ) : (
          <p className="text-sm text-ink-2">
            Your business isn&apos;t visible to clients right now. Contact support for details.
          </p>
        )}
      </Card>

      {remaining > 0 ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">Finish your profile</h2>
            <span className="text-sm text-ink-2">
              {steps.length - remaining} of {steps.length} done
            </span>
          </div>
          <ul className="flex flex-col">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex min-h-12 items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
                  <span
                    aria-hidden="true"
                    className={`flex size-6 items-center justify-center rounded-full ${
                      s.done ? "bg-navy-900 text-white" : "border-2 border-control"
                    }`}
                  >
                    {s.done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={`flex-1 ${s.done ? "text-ink-2 line-through" : "font-semibold"}`}>
                    {s.label}
                    <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3">
        <Link href="/vendor/packages" className="flex flex-col gap-2 rounded-[20px] bg-navy-900 p-4 text-white shadow-card">
          <span className="text-xs text-on-navy-2">Average price</span>
          <span className="text-[22px] font-bold text-gold-300">
            {vendor.avgPriceCents ? formatCents(vendor.avgPriceCents) : "Not set"}
          </span>
          <span className="text-sm">
            {vendor.packages.filter((p) => p.active).length} active packages
          </span>
        </Link>
        <Link href="/vendor/profile" className="flex flex-col gap-2 rounded-[20px] bg-surface p-4 shadow-card">
          <span className="text-xs text-ink-2">Portfolio</span>
          <span className="text-[22px] font-bold">
            {vendor.images.length}
            <span className="text-sm font-medium text-ink-2"> / {vendor.maxPortfolio}</span>
          </span>
          <span className="text-sm text-ink-2">photos</span>
        </Link>
      </section>

      <Link href="/vendor/preview" className="flex items-center gap-4 rounded-[20px] bg-surface p-5 shadow-card">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Preview as a client</span>
          <span className="mt-1 block text-sm text-ink-2">See your profile the way clients will.</span>
        </span>
        <ArrowBadge tone="dark" />
      </Link>
    </div>
  );
}
