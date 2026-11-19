"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import type { Permission } from "../../../convex/lib/permissions";

type Item = { href: string; label: string; permission?: Permission };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users", permission: "users:view" },
      { href: "/admin/roles", label: "Roles & permissions", permission: "roles:view" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/vendors", label: "Vendors", permission: "vendors:view" },
      { href: "/admin/categories", label: "Categories", permission: "categories:view" },
      { href: "/admin/event-types", label: "Event types", permission: "eventTypes:view" },
      { href: "/admin/bookings", label: "Events & bookings", permission: "events:view" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/moderation", label: "Moderation", permission: "reports:view" },
      { href: "/admin/reviews", label: "Vendor reviews", permission: "reports:view" },
      { href: "/admin/content", label: "Site content", permission: "content:view" },
    ],
  },
  {
    title: "System",
    items: [{ href: "/admin/audit-log", label: "Audit log", permission: "auditLog:view" }],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
};

/** Navy sidebar (A-02 to A-11); items the admin can't use are hidden. */
export function AdminSidebar() {
  const me = useMe();
  const pathname = usePathname();
  const can = (p?: Permission) => !p || me.permissions.includes(p);

  const [open, setOpen] = useState(false);

  return (
    <aside className="sticky top-0 z-30 flex w-full flex-col gap-6 bg-navy-900 px-5 py-4 text-white lg:h-dvh lg:w-60 lg:flex-[0_0_240px] lg:overflow-y-auto lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin" className="font-display text-2xl leading-none font-bold whitespace-nowrap">
          Event Planner <span className="text-gold-300">Admin</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-menu"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 items-center gap-2 rounded-full bg-navy-700 px-4 text-sm font-semibold lg:hidden"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          Menu
        </button>
      </div>
      <div id="admin-menu" className={`${open ? "flex" : "hidden"} max-h-[calc(100dvh-5rem)] flex-col gap-6 overflow-y-auto lg:flex lg:max-h-none lg:flex-1 lg:overflow-visible`}>
      <nav aria-label="Admin" className="flex flex-col gap-5">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => can(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="px-3 text-xs font-semibold text-on-navy-2">{group.title}</p>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-full px-3 text-sm font-medium ${
                      active
                        ? "bg-navy-700 text-gold-300 shadow-[inset_3px_0_0_var(--color-gold-500)]"
                        : "text-white hover:bg-navy-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-[20px] bg-navy-700 p-3 lg:mt-auto">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900"
        >
          {(me.name ?? "A").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name}</p>
          <p className="text-xs text-on-navy-2">{ROLE_LABEL[me.adminRole ?? ""] ?? me.adminRole ?? "Admin"}</p>
        </div>
        <Link href="/admin/account" aria-label="My account" className="flex size-11 items-center justify-center rounded-full text-gold-300 hover:bg-navy-900">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </Link>
      </div>
      <SignOutButton className="-mt-3 self-start px-3 whitespace-nowrap text-gold-300 hover:bg-navy-700" />
      </div>
    </aside>
  );
}
