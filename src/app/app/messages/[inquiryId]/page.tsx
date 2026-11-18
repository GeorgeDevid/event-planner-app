"use client";

import { useParams } from "next/navigation";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Conversation } from "@/components/messaging/conversation";

/** C-13: a conversation with one vendor. */
export default function ClientThreadPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  return <Conversation inquiryId={inquiryId as Id<"inquiries">} backHref="/app/messages" />;
}
