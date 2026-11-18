"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { FullPageLoader } from "@/components/ui/loader";
import { VendorProfileView } from "@/components/vendor/profile-view";
import { useMyVendor } from "@/components/vendor/use-vendor";
import { formatCents } from "@/lib/format";

/** V-03: "Preview my profile exactly as clients see it". */
export default function VendorPreview() {
  const vendor = useMyVendor();
  const profile = useQuery(api.vendors.publicProfile, vendor ? { vendorId: vendor._id } : "skip");
  if (!profile) return <FullPageLoader />;

  return (
    <div className="-mx-5 -mt-6">
      <p role="status" className="mx-5 mt-4 mb-3 rounded-2xl bg-info-bg px-4 py-3 text-sm font-medium text-info">
        Preview: this is how clients will see your profile
        {profile.isPreview ? " once it's approved" : ""}.
      </p>
      <VendorProfileView
        profile={profile}
        actionsBottom="bottom-24"
        topLeft={
          <Link
            href="/vendor/profile"
            aria-label="Back to profile"
            className="flex size-11 items-center justify-center rounded-full bg-white text-navy-900 shadow-card"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
        }
        actions={
          <>
            <div className="flex-1">
              <p className="text-xs text-on-navy-2">Avg. price</p>
              <p className="text-[20px] font-bold">
                {profile.avgPriceCents ? formatCents(profile.avgPriceCents) : "On request"}
              </p>
            </div>
            <span className="rounded-full bg-gold-cta px-5 py-3 text-sm font-semibold text-navy-900">
              Request booking
            </span>
          </>
        }
      />
    </div>
  );
}
