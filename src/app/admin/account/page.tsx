"use client";

import { AdminHeader } from "@/components/admin/ui";
import { ChangePasswordForm } from "@/components/messaging/change-password";
import { NotificationList } from "@/components/messaging/notifications";

export default function AdminAccount() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminHeader title="My" accent="account" />
      <section className="rounded-[20px] bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-[17px] font-bold">Change password</h2>
        <ChangePasswordForm />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">Notifications</h2>
        <NotificationList />
      </section>
    </div>
  );
}
