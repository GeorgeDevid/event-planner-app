import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** Simple page frame for public pages (FAQ, Terms, Privacy). */
export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex items-center justify-between bg-navy-900 px-5 py-4 lg:px-10">
        <Logo tone="light" />
        <Link href="/sign-in" className="min-h-11 rounded-full bg-surface px-5 py-3 text-sm font-semibold text-navy-900">Log in</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-[36px] leading-tight font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy-900 px-5 pt-12 pb-8 text-sm text-on-navy-2 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 max-w-xs">Event vendors across the Greater Toronto Area, and one place to plan it all.</p>
        </div>
        <nav aria-label="Plan">
          <p className="font-semibold text-white">Plan</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link href="/vendors" className="hover:text-white">Browse vendors</Link></li>
            <li><Link href="/sign-up" className="hover:text-white">Create an account</Link></li>
            <li><Link href="/sign-in" className="hover:text-white">Log in</Link></li>
          </ul>
        </nav>
        <nav aria-label="Vendors">
          <p className="font-semibold text-white">Vendors</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link href="/sign-up" className="hover:text-white">List your business</Link></li>
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
          </ul>
        </nav>
        <nav aria-label="Site">
          <p className="font-semibold text-white">Legal</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6">© Event Planner · Greater Toronto Area</p>
    </footer>
  );
}
