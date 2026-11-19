import { AppShell } from "@/components/shell/app-shell";
import { icons } from "@/components/shell/nav-icons";
import { RoleGate } from "@/components/shell/role-gate";

const NAV = [
  { href: "/app", label: "Home", icon: icons.home },
  { href: "/app/events", label: "Events", icon: icons.calendar },
  { href: "/app/messages", unreadBadge: true, label: "Messages", icon: icons.chat },
  { href: "/app/profile", label: "Profile", icon: icons.user },
];

export default function ClientLayout({ children }: LayoutProps<"/app">) {
  return (
    <RoleGate role="client">
      <AppShell items={NAV} label="Main">
        {children}
      </AppShell>
    </RoleGate>
  );
}
