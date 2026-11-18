"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 60 * 1000;

/**
 * A-01 #3: admins are signed out after 30 minutes without activity, with a
 * one-minute warning. Activity in any admin tab counts (shared via storage).
 */
export function IdleSignOut() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const KEY = "admin-last-activity";
    const read = () => {
      try {
        return Number(window.localStorage.getItem(KEY)) || last.current;
      } catch {
        return last.current;
      }
    };
    const touch = () => {
      const now = Date.now();
      if (now - last.current < 5000) return; // throttle
      last.current = now;
      setWarning(false);
      try {
        window.localStorage.setItem(KEY, String(now));
      } catch {
        // storage can be unavailable; this tab's timer still works
      }
    };
    last.current = Date.now();
    touch();
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const timer = window.setInterval(async () => {
      const idle = Date.now() - Math.max(read(), last.current);
      if (idle >= IDLE_MS) {
        window.clearInterval(timer);
        await signOut();
        router.replace("/sign-in?reason=idle");
      } else {
        setWarning(idle >= IDLE_MS - WARN_MS);
      }
    }, 15_000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, [signOut, router]);

  if (!warning) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[20px] bg-navy-900 p-4 text-sm text-white shadow-float">
      <p className="flex-1">You&apos;ll be logged out in about a minute because you&apos;ve been inactive.</p>
      <button type="button" onClick={() => setWarning(false)} className="min-h-11 rounded-full bg-gold-300 px-4 font-semibold text-navy-900">
        Stay logged in
      </button>
    </div>
  );
}
