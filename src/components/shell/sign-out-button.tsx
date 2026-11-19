"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ className = "" }: { className?: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.replace("/sign-in");
      }}
      className={`press min-h-11 rounded-full px-4 text-sm font-semibold ${className}`}
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
