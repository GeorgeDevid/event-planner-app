import { IdleSignOut } from "./idle-sign-out";
import { AdminSidebar } from "./sidebar";
import { RoleGate } from "@/components/shell/role-gate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <RoleGate role="admin">
      <div className="flex min-h-dvh flex-wrap content-start bg-cream lg:content-stretch">
        <AdminSidebar />
        <main className="min-w-0 flex-[999_1_560px] p-6 lg:p-10">{children}</main>
        <IdleSignOut />
      </div>
    </RoleGate>
  );
}
