"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { ArrowBadge, LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/kit";
import { formatIsoDate, shortAddress } from "@/lib/format";

/** My events: upcoming first, drafts to finish, then past ones. */
export default function MyEvents() {
  const events = useQuery(api.events.mine);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My events" action={<LinkButton href="/app/events/new" variant="gold" className="min-h-10 px-4 text-sm">New event</LinkButton>} />
      {events === undefined ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
          <p className="font-semibold">No events yet</p>
          <p className="mt-1 text-sm text-ink-2">Plan a wedding, birthday or anything else, and we&apos;ll line up vendors near it.</p>
          <LinkButton href="/app/events/new" className="mt-4">Plan an event</LinkButton>
        </div>
      ) : (
        <ul className="stagger grid gap-3 md:grid-cols-2">
          {events.map((e) => {
            const href = e.status === "draft" ? `/app/events/${e._id}/setup` : `/app/events/${e._id}`;
            return (
              <li key={e._id}>
                <Link href={href} className={`press-soft flex items-center gap-4 rounded-[20px] p-4 shadow-card ${e.past ? "bg-surface-2" : "bg-surface"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gold-text">
                      {e.type}
                      {e.status === "draft" ? " · Draft" : e.past ? " · Past" : ""}
                    </p>
                    <p className="truncate text-[17px] font-bold">{e.name}</p>
                    <p className="truncate text-sm text-ink-2">
                      {[e.date ? formatIsoDate(e.date) : null, e.address ? shortAddress(e.address) : null].filter(Boolean).join(" · ")}
                    </p>
                    {e.status === "draft" ? (
                      <p className="mt-1 text-sm font-semibold text-navy-900">Finish setup</p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-2">
                        {e.bookedCount} of {e.serviceCount} services booked · {e.shortlistCount} saved
                      </p>
                    )}
                  </div>
                  <ArrowBadge tone="dark" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
