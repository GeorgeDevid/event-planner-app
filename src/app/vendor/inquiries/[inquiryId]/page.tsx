"use client";

import { useParams } from "next/navigation";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Conversation } from "@/components/messaging/conversation";

/** V-06 / V-07: one client conversation with quotes and booking actions. */
export default function VendorThreadPage() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  return <Conversation inquiryId={inquiryId as Id<"inquiries">} backHref="/vendor/inquiries" />;
}
