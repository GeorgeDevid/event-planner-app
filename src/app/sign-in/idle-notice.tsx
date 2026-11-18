"use client";

import { useSearchParams } from "next/navigation";

export function IdleNotice() {
  if (useSearchParams().get("reason") !== "idle") return null;
  return (
    <p role="status" className="mt-4 rounded-2xl bg-info-bg px-4 py-3 text-sm font-medium text-info">
      You were logged out after 30 minutes without activity. Log in again to continue.
    </p>
  );
}
