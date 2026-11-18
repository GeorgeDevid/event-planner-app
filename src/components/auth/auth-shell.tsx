import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/**
 * Sign-up / log-in layout: a dusk photo panel with a two-line serif headline
 * and the form in a white sheet (C-01a, C-01b). On phones the photo sits on
 * top and the sheet overlaps it.
 */
export function AuthShell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-cream lg:grid lg:grid-cols-2">
      <section
        aria-label="Welcome"
        className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-dusk p-6 lg:min-h-dvh lg:p-12"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-navy-900/0 via-navy-900/10 to-navy-900/80"
        />
        <div className="relative">
          <Logo tone="light" />
        </div>
        <div className="relative pb-8 lg:pb-0">
          <h1 className="font-display text-[40px] leading-[1.05] font-bold text-white lg:text-6xl">
            {title}
            <br />
            <span className="text-gold-300">{accent}</span>
          </h1>
        </div>
      </section>
      <section className="relative -mt-8 rounded-t-[28px] bg-surface px-5 pt-8 pb-12 shadow-float lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:shadow-none">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
