import { PageHeader } from "@/components/ui/kit";

/** Placeholder until inquiries and messages (C-12, C-13) are built. */
export default function ClientMessages() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" />
      <div className="rounded-[20px] bg-surface p-6 text-center shadow-card">
        <p className="font-semibold">No messages yet</p>
        <p className="mt-1 text-sm text-ink-2">
          When you contact a vendor, your conversation will show up here.
        </p>
      </div>
    </div>
  );
}
