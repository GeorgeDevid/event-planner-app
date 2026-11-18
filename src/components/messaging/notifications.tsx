"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Bell with the unread count, for page headers. */
export function NotificationBell({ href }: { href: string }) {
  const count = useQuery(api.notifications.unreadCount) ?? 0;
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="relative flex size-11 items-center justify-center rounded-full bg-surface text-navy-900 shadow-card"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 ? (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-navy-900">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/** The list of my notifications, newest first. */
export function NotificationList() {
  const rows = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const router = useRouter();
  if (rows === undefined) return <p className="text-sm text-ink-2">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-ink-2">Updates about inquiries and bookings will appear here.</p>
      </div>
    );
  }
  const unread = rows.some((r) => !r.read);
  return (
    <div className="flex flex-col gap-3">
      {unread ? (
        <Button type="button" variant="ghost" className="self-end px-3 text-sm" onClick={() => void markRead({})}>
          Mark all as read
        </Button>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rows.map((n) => (
          <li key={n._id}>
            <button
              type="button"
              onClick={() => {
                void markRead({ notificationId: n._id });
                if (n.href) router.push(n.href);
              }}
              className={`flex w-full items-start gap-3 rounded-[20px] p-4 text-left shadow-card ${n.read ? "bg-surface" : "bg-surface ring-2 ring-gold-500/60"}`}
            >
              {!n.read ? <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-gold-500" /> : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {n.title}
                  {!n.read ? <span className="sr-only"> (unread)</span> : null}
                </span>
                {n.body ? <span className="mt-0.5 block text-sm text-ink-2">{n.body}</span> : null}
                <span className="mt-1 block text-xs text-ink-2">{when(n.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
