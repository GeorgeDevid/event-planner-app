"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Card, Segmented } from "@/components/ui/kit";
import { formatIsoDate } from "@/lib/format";

/** V-08: how the listing is doing, and bookings coming up. */
export function VendorStats() {
  const stats = useQuery(api.vendorStats.mine);
  const [range, setRange] = useState<"last7" | "last30">("last30");
  if (!stats) return null;
  const tiles = [
    { label: "Profile views", value: stats.views[range] },
    { label: "Inquiries", value: stats.inquiries[range] },
    { label: "Quotes sent", value: stats.quotes[range] },
    { label: "Bookings accepted", value: stats.bookings[range] },
  ];
  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold">Activity</h2>
          <div className="w-44">
            <Segmented label="Period" value={range} onChange={setRange} options={[{ value: "last7", label: "7 days" }, { value: "last30", label: "30 days" }]} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-xs text-ink-2">{t.label}</dt>
              <dd className="text-[24px] font-bold">{t.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Next 30 days</h2>
        {stats.upcoming.length === 0 ? (
          <p className="text-sm text-ink-2">No accepted bookings in the next 30 days.</p>
        ) : (
          <ul className="flex flex-col">
            {stats.upcoming.map((b) => (
              <li key={b._id}>
                <Link href={b.inquiryId ? `/vendor/inquiries/${b.inquiryId}` : "/vendor/inquiries"} className="flex min-h-12 items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0">
                  <span className="font-semibold">{formatIsoDate(b.serviceDate)}</span>
                  <span className="truncate text-ink-2">{[b.clientName, b.packageName].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
