"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode };

/** Floating bottom tab bar; the active tab is a navy pill (design: Dusk & Gold). */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
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
                <span aria-hidden="true">{item.icon}</span>
                <span className={active ? "" : "sr-only sm:not-sr-only"}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const stroke = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const icons = {
  home: (
    <svg {...stroke}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  calendar: (
    <svg {...stroke}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  chat: (
    <svg {...stroke}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  ),
  user: (
    <svg {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  grid: (
    <svg {...stroke}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
  inbox: (
    <svg {...stroke}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
    </svg>
  ),
};
