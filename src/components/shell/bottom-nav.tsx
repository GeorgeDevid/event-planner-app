"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";

export type NavItem = { href: string; label: string; icon: ReactNode; unreadBadge?: boolean };

/** Floating bottom tab bar; the active tab is a navy pill (design: Dusk & Gold). */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  // Unread messages across my conversations (C-13 #2).
  const unread = useQuery(api.inquiries.unreadCount, items.some((i) => i.unreadBadge) ? {} : "skip") ?? 0;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-[28px] bg-surface p-2 shadow-float"
    >
      <ul className="flex items-center justify-between">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== items[0].href && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-semibold ${
                  active ? "bg-navy-900 text-white" : "text-ink-2"
                }`}
              >
                <span aria-hidden="true" className="relative">
                  {item.icon}
                  {item.unreadBadge && unread > 0 ? (
                    <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-900">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className={active ? "" : "sr-only sm:not-sr-only"}>
                  {item.label}
                  {item.unreadBadge && unread > 0 ? <span className="sr-only">, {unread} unread</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
