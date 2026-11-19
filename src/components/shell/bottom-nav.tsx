"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { useLiquidIndicator } from "@/lib/use-liquid-indicator";

export type NavItem = { href: string; label: string; icon: ReactNode; unreadBadge?: boolean };

export function activeIndex(pathname: string, items: NavItem[]) {
  return items.findIndex(
    (item) => pathname === item.href || (item.href !== items[0].href && pathname.startsWith(item.href)),
  );
}

/** A plain left click (not opening in a new tab or window). */
export const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * The tab to highlight. Follows the route, but jumps to a tapped tab right
 * away, so the highlight moves on tap instead of after the next page loads.
 */
export function useOptimisticTab(items: NavItem[], pathname: string) {
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null);
  const routeIndex = activeIndex(pathname, items);
  const current = pending && pending.from === pathname ? pending.index : routeIndex;
  return { current, select: (index: number) => setPending({ index, from: pathname }) };
}

/**
 * Floating bottom tab bar (phones). Equal-width tabs, icon over label; a navy
 * pill flows between tabs as you switch (Dusk & Gold).
 */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const { current, select } = useOptimisticTab(items, pathname);
  const onRoute = activeIndex(pathname, items);
  const { containerRef, indicatorRef } = useLiquidIndicator<HTMLUListElement>(current, "[data-active]");
  // Unread messages across my conversations (C-13 #2).
  const unread = useQuery(api.inquiries.unreadCount, items.some((i) => i.unreadBadge) ? {} : "skip") ?? 0;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-[28px] bg-surface p-1.5 shadow-float"
    >
      <ul ref={containerRef} className="relative flex items-stretch">
        <span ref={indicatorRef} aria-hidden="true" className="liquid-indicator bg-navy-900" />
        {items.map((item, i) => {
          const active = i === current;
          return (
            <li key={item.href} className="relative flex-1">
              <Link
                href={item.href}
                aria-current={i === onRoute ? "page" : undefined}
                data-active={active ? "" : undefined}
                onClick={(e) => isPlainClick(e) && select(i)}
                className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-semibold duration-200 ${
                  active ? "text-white" : "text-ink-2"
                }`}
              >
                <span aria-hidden="true" className="relative">
                  {item.icon}
                  {item.unreadBadge && unread > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-900">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">
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
