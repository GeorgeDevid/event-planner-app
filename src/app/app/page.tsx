"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { useMe } from "@/components/shell/role-gate";
import { HomeBanners } from "@/components/content/banners";
import { NotificationBell } from "@/components/messaging/notifications";
import { ArrowBadge } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/format";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

/** Client home (C-02): the two ways in, Plan an event and Find a service. */
export default function ClientHome() {
  const me = useMe();
  const initials = (me.name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-7">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900"
        >
          {initials}
        </span>
        <div className="flex-1">
          <p className="text-xs text-ink-2">{greeting()}</p>
          <p className="text-[15px] font-bold">{me.name}</p>
        </div>
        <NotificationBell href="/app/notifications" />
      </header>

      <HomeBanners />

      <h1 className="text-[28px] leading-[34px] font-bold tracking-tight">
        Plan your
        <br />
        <span className="text-gold-display">perfect event</span>
      </h1>

      <section aria-label="Get started" className="flex flex-col gap-4">
        <Link
          href="/app/events/new"
          className="relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-[24px] bg-dusk p-5 text-white shadow-card"
        >
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-navy-900/0 to-navy-900/75" />
          <span className="absolute top-4 left-4 rounded-full bg-navy-900/55 px-3 py-1 text-xs font-medium">
            Step by step
          </span>
          <span className="relative font-display text-[34px] leading-none font-bold">Plan an event</span>
          <span className="relative mt-2 text-sm">
            Weddings, birthdays and more. Tell us about it and we&apos;ll line up the right vendors nearby.
          </span>
          <span className="relative mt-4 inline-flex w-fit items-center gap-3 rounded-full bg-navy-900 py-2 pr-5 pl-5 text-sm font-semibold">
            Start planning
            <ArrowBadge />
          </span>
        </Link>

        <Link
          href="/app/search"
          className="flex items-center gap-4 rounded-[20px] bg-surface p-5 shadow-card"
        >
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Find a service</span>
            <span className="mt-1 block text-sm text-ink-2">
              Need just one thing? A spa day, a barber or flowers.
            </span>
          </span>
          <ArrowBadge tone="dark" />
        </Link>
      </section>

<UpcomingEvents />
    </div>
  );
}

function UpcomingEvents() {
  const events = useQuery(api.events.mine);
  const upcoming = (events ?? []).filter((e) => !e.past).slice(0, 3);
  if (upcoming.length === 0) return null;
  return (
    <section aria-labelledby="your-events" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="your-events" className="text-[17px] font-bold">Your events</h2>
        <Link href="/app/events" className="text-sm font-semibold text-gold-text">See all</Link>
      </div>
      <ul className="flex flex-col gap-2">
        {upcoming.map((e) => (
          <li key={e._id}>
            <Link
              href={e.status === "draft" ? `/app/events/${e._id}/setup` : `/app/events/${e._id}`}
              className="flex items-center gap-3 rounded-[20px] bg-surface p-4 shadow-card"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-gold-text">
                  {e.type}
                  {e.status === "draft" ? " · Draft" : ""}
                </span>
                <span className="block truncate font-semibold">{e.name}</span>
                <span className="block text-sm text-ink-2">{e.date ? formatIsoDate(e.date) : "No date yet"}</span>
              </span>
              <ArrowBadge tone="dark" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
