"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { activeIndex, BottomNav, isPlainClick, useOptimisticTab, type NavItem } from "@/components/shell/bottom-nav";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { useMe } from "@/components/shell/role-gate";
import { Logo } from "@/components/ui/logo";
import { useLiquidIndicator } from "@/lib/use-liquid-indicator";

/**
 * Which way the content should slide when switching tabs: from the right when
 * moving to a tab further along, from the left when going back, and a plain
 * rise for pages within the same tab.
 */
function useTabDirection(index: number) {
  const [prev, setPrev] = useState(index);
  const [dir, setDir] = useState(0);
  if (index !== prev) {
    setPrev(index);
    setDir(index >= 0 && prev >= 0 ? Math.sign(index - prev) : 0);
  }
  return dir;
}

/**
 * Client and vendor frame. Phones: one column with the floating bottom tab
 * bar. Desktop (lg): a sidebar on the left and a wider content column; the
 * tab bar is hidden. Sets --side and --dock for the floating bars (see the
 * `dock` utility in globals.css).
 */
export function AppShell({
  items,
  label,
  logoSuffix,
  children,
}: {
  items: NavItem[];
  label: string;
  logoSuffix?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const dir = useTabDirection(activeIndex(pathname, items));
  // Read by the page-in animation in each route template.
  const slide = { "--page-dx": `${dir * 28}px`, "--page-dy": dir ? "0px" : "8px" } as CSSProperties;
  return (
    <div className="min-h-dvh [--dock:6rem] lg:flex lg:[--dock:1.5rem] lg:[--side:16rem]">
      <SideNav items={items} label={label} logoSuffix={logoSuffix} />
      <main style={slide} className="mx-auto min-h-dvh w-full max-w-md px-5 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl lg:px-10 lg:pt-10 lg:pb-16">
        {children}
      </main>
      <div className="lg:hidden">
        <BottomNav items={items} label={label} />
      </div>
    </div>
  );
}

function SideNav({ items, label, logoSuffix }: { items: NavItem[]; label: string; logoSuffix?: string }) {
  const pathname = usePathname();
  const { current, select } = useOptimisticTab(items, pathname);
  const onRoute = activeIndex(pathname, items);
  const { containerRef, indicatorRef } = useLiquidIndicator<HTMLUListElement>(current, "[data-active]");
  const me = useMe();
  const unread = useQuery(api.inquiries.unreadCount, items.some((i) => i.unreadBadge) ? {} : "skip") ?? 0;
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-900 px-4 py-8 text-white lg:flex">
      <div className="px-3">
        <Logo tone="light" />
        {logoSuffix ? <p className="mt-1.5 text-[11px] font-semibold tracking-[0.18em] text-gold-300 uppercase">{logoSuffix}</p> : null}
      </div>
      <nav aria-label={label} className="mt-10">
        <ul ref={containerRef} className="relative flex flex-col gap-1">
          <span ref={indicatorRef} aria-hidden="true" className="liquid-indicator bg-gold-cta" />
          {items.map((item, i) => {
            const active = i === current;
            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  aria-current={i === onRoute ? "page" : undefined}
                  data-active={active ? "" : undefined}
                  onClick={(e) => isPlainClick(e) && select(i)}
                  className={`press flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold duration-200 ${
                    active ? "text-navy-900" : "text-on-navy-2 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.unreadBadge && unread > 0 ? (
                    <span className="flex min-w-6 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-navy-900">
                      {unread > 99 ? "99+" : unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-white/10 px-3 pt-5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900">
            {(me.name ?? "?")
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join("")}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{me.name}</span>
            <span className="block truncate text-xs text-on-navy-2">{me.email}</span>
          </span>
        </div>
        <SignOutButton className="self-start px-0 text-on-navy-2 hover:text-white" />
      </div>
    </aside>
  );
}

export type { NavItem };
export type ShellChildren = { children: ReactNode };
