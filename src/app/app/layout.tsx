import { BottomNav, icons } from "@/components/shell/bottom-nav";
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
      <div className="mx-auto min-h-dvh max-w-md px-5 pt-6 pb-28">{children}</div>
      <BottomNav items={NAV} label="Main" />
    </RoleGate>
  );
}
