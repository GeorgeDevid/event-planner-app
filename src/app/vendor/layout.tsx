import { BottomNav, icons } from "@/components/shell/bottom-nav";
import { RoleGate } from "@/components/shell/role-gate";

const NAV = [
  { href: "/vendor", label: "Dashboard", icon: icons.grid },
  { href: "/vendor/inquiries", unreadBadge: true, label: "Inquiries", icon: icons.inbox },
  { href: "/vendor/calendar", label: "Calendar", icon: icons.calendar },
  { href: "/vendor/profile", label: "Profile", icon: icons.user },
];

export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return (
    <RoleGate role="vendor">
      <div className="mx-auto min-h-dvh max-w-md px-5 pt-6 pb-28">{children}</div>
      <BottomNav items={NAV} label="Vendor" />
    </RoleGate>
  );
}
