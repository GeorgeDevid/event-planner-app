"use client";

import Link from "next/link";
import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ArrowBadge } from "@/components/ui/button";

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
        <SignOutButton className="bg-surface text-navy-900 shadow-card" />
      </header>

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

      <p className="rounded-[20px] bg-surface-2 p-4 text-sm text-ink-2">
        Event planning and vendor search arrive in the next build steps.
      </p>
    </div>
  );
}
