"use client";

import { useMe } from "@/components/shell/role-gate";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Card, PageHeader } from "@/components/ui/kit";

/** Basic account page for clients. */
export default function ClientProfile() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" />
      <Card className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold text-ink-2">Name</p>
          <p className="text-[15px] font-semibold">{me.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-2">Email</p>
          <p className="text-[15px]">{me.email}</p>
        </div>
      </Card>
      <SignOutButton className="self-start bg-surface text-navy-900 shadow-card" />
    </div>
  );
}
