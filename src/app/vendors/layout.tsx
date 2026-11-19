import Link from "next/link";
import type { ReactNode } from "react";

/** Public browsing for visitors (C-01 #6): same screens as the client app, no account needed. */
export default function PublicVendorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream">
      <div className="mx-auto min-h-dvh max-w-md px-5 pt-6 pb-28">{children}</div>
      <nav aria-label="Account" className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center gap-2 rounded-[24px] bg-navy-900 p-2 pl-5 text-sm text-white shadow-float">
        <p className="flex-1">Plan your event with these vendors</p>
        <Link href="/sign-in" className="min-h-11 rounded-full px-4 py-3 font-semibold text-gold-300">Log in</Link>
        <Link href="/sign-up" className="min-h-11 rounded-full bg-gold-300 px-4 py-3 font-semibold text-navy-900">Sign up</Link>
      </nav>
    </div>
  );
}
