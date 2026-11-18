import { ArrowBadge, LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const CATEGORIES = [
  "Event planners",
  "Photography",
  "Catering",
  "Entertainment",
  "Emcees",
  "Car rental",
  "Florals & decor",
  "Salon & makeup",
  "Spa",
  "Tailoring",
  "Suit & gown rental",
];

export default function Landing() {
  return (
    <main className="min-h-dvh bg-cream">
      <section className="relative flex min-h-[86dvh] flex-col overflow-hidden bg-dusk px-5 pt-6 pb-10 lg:px-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-navy-900/0 via-navy-900/10 to-navy-900/85"
        />
        <header className="relative flex items-center justify-between">
          <Logo tone="light" />
          <LinkButton href="/sign-in" variant="secondary" className="border-none">
            Log in
          </LinkButton>
        </header>
        <div className="relative mt-auto max-w-2xl">
          <h1 className="font-display text-[44px] leading-[1.02] font-bold text-white sm:text-7xl">
            Every celebration,
            <br />
            <span className="text-gold-300">beautifully planned</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-white">
            Find trusted planners, photographers, caterers, florists, salons and more across the
            Greater Toronto Area, and manage your whole event in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/sign-up" variant="gold" className="pr-4">
              Let&apos;s plan
              <ArrowBadge tone="dark" />
            </LinkButton>
            <LinkButton href="/sign-up" variant="secondary" className="border-none">
              List your business
            </LinkButton>
          </div>
        </div>
      </section>

      <section aria-labelledby="services" className="px-5 py-12 lg:px-16">
        <h2 id="services" className="text-[22px] font-bold tracking-tight">
          Everything your event needs
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li
              key={c}
              className="rounded-full bg-surface px-4 py-2.5 text-sm font-medium text-navy-900 shadow-card"
            >
              {c}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
