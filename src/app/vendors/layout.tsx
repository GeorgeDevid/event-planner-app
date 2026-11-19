import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/**
 * Public browsing for visitors (C-01 #6): same screens as the client app, no
 * account needed. Desktop gets a top bar; phones keep the floating bottom bar.
 */
export default function PublicVendorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream [--dock:5.75rem] lg:[--dock:1.5rem]">
      <header className="hidden bg-navy-900 lg:block">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-10 py-4">
          <Logo tone="light" />
          <nav aria-label="Account" className="flex items-center gap-2 text-sm">
            <span className="mr-2 text-on-navy-2">Plan your event with these vendors</span>
            <Link href="/sign-in" className="min-h-11 rounded-full px-4 py-3 font-semibold text-gold-300 hover:bg-white/10">Log in</Link>
            <Link href="/sign-up" className="min-h-11 rounded-full bg-gold-300 px-5 py-3 font-semibold text-navy-900">Sign up</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto min-h-dvh max-w-md px-5 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl lg:px-10 lg:pt-10 lg:pb-16">{children}</div>
      <nav aria-label="Account" className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center gap-2 rounded-[24px] bg-navy-900 p-2 pl-5 text-sm text-white shadow-float lg:hidden">
        <p className="flex-1">Plan your event with these vendors</p>
        <Link href="/sign-in" className="min-h-11 rounded-full px-4 py-3 font-semibold text-gold-300">Log in</Link>
        <Link href="/sign-up" className="min-h-11 rounded-full bg-gold-300 px-4 py-3 font-semibold text-navy-900">Sign up</Link>
      </nav>
    </div>
  );
}
