import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** Simple page frame for public pages (FAQ, Terms, Privacy). */
export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex items-center justify-between bg-navy-900 px-5 py-4 lg:px-16">
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
    <footer className="border-t border-line px-5 py-8 text-sm text-ink-2 lg:px-16">
      <nav aria-label="Site" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/faq" className="hover:text-ink">FAQ</Link>
        <Link href="/terms" className="hover:text-ink">Terms of Service</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
      </nav>
      <p className="mt-3">© {new Date().getFullYear()} Event Planner · Greater Toronto Area</p>
    </footer>
  );
}
