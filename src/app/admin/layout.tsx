import { AdminSidebar } from "./sidebar";
import { RoleGate } from "@/components/shell/role-gate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <RoleGate role="admin">
      <div className="flex min-h-dvh flex-wrap bg-cream">
        <AdminSidebar />
        <main className="min-w-0 flex-[999_1_560px] p-6 lg:p-10">{children}</main>
      </div>
    </RoleGate>
  );
}
