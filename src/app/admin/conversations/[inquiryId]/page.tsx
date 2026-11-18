"use client";

import { useParams } from "next/navigation";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Conversation } from "@/components/messaging/conversation";

/** Read-only view of a conversation for admins with Messages: View. */
export default function AdminConversationPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  return (
    <div className="mx-auto max-w-xl">
      <Conversation inquiryId={inquiryId as Id<"inquiries">} backHref="/admin/bookings?tab=inquiries" />
    </div>
  );
}
