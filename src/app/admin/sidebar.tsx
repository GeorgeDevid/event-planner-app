"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <aside className="flex w-full flex-col gap-6 bg-navy-900 p-6 text-white lg:min-h-dvh lg:w-60 lg:flex-[0_0_240px]">
      <Link href="/admin" className="font-display text-2xl leading-none font-bold">
        Event Planner <span className="text-gold-300">Admin</span>
      </Link>
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
      <div className="mt-auto flex items-center gap-3 rounded-[20px] bg-navy-700 p-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-gold-300 text-sm font-bold text-navy-900"
        >
          {(me.name ?? "A").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name}</p>
          <p className="text-xs text-on-navy-2">{ROLE_LABEL[me.adminRole ?? ""] ?? "Admin"}</p>
        </div>
        <SignOutButton className="text-gold-300 hover:bg-navy-900" />
      </div>
    </aside>
  );
}
