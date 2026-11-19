import { AppShell } from "@/components/shell/app-shell";
import { icons } from "@/components/shell/nav-icons";
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
      <AppShell items={NAV} label="Vendor" logoSuffix="for vendors">
        {children}
      </AppShell>
    </RoleGate>
  );
}
