"use client";

import { ChangePasswordForm } from "@/components/messaging/change-password";
import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Card, PageHeader } from "@/components/ui/kit";

export default function VendorAccount() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" backHref="/vendor" />
      <Card className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-ink-2">Signed in as</p>
        <p className="text-[15px] font-semibold">{me.name}</p>
        <p className="text-sm text-ink-2">{me.email}</p>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-[17px] font-bold">Change password</h2>
        <ChangePasswordForm />
      </Card>
      <SignOutButton className="self-start bg-surface text-navy-900 shadow-card" />
    </div>
  );
}
