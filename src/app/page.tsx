import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/components/content/reveal";
import { LandingTestimonials } from "@/components/content/testimonials";
import { SiteFooter } from "@/components/content/public-shell";
import { ArrowBadge, LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import hero from "../../public/images/hero.webp";
import carRental from "../../public/images/car-rental.webp";
import catering from "../../public/images/catering.webp";
import emcees from "../../public/images/emcees.webp";
import entertainment from "../../public/images/entertainment.webp";
import florals from "../../public/images/florals.webp";
import photography from "../../public/images/photography.webp";
import placeSetting from "../../public/images/place-setting.webp";
import planners from "../../public/images/planners.webp";
import salon from "../../public/images/salon.webp";
import spa from "../../public/images/spa.webp";
import suitGown from "../../public/images/suit-gown.webp";
import tailoring from "../../public/images/tailoring.webp";
import vendorOwner from "../../public/images/vendor-owner.webp";

const SERVICES: { name: string; blurb: string; image: StaticImageData }[] = [
  { name: "Event planners", blurb: "Full planning or day-of coordination", image: planners },
  { name: "Photography", blurb: "Photo and video, candid to classic", image: photography },
  { name: "Catering", blurb: "Menus for every guest list and budget", image: catering },
  { name: "Entertainment", blurb: "Live bands, DJs and performers", image: entertainment },
  { name: "Emcees", blurb: "Hosts who keep the night moving", image: emcees },
  { name: "Car rental", blurb: "Arrive in style, with a driver", image: carRental },
  { name: "Florals & decor", blurb: "Centrepieces, stages and styling", image: florals },
  { name: "Salon & makeup", blurb: "Hair and makeup, on site or in studio", image: salon },
  { name: "Spa", blurb: "Unwind before the big day", image: spa },
  { name: "Tailoring", blurb: "Fittings and alterations", image: tailoring },
  { name: "Suit & gown rental", blurb: "Look the part without buying", image: suitGown },
];

const STEPS = [
  { title: "Tell us about your event", body: "Pick the type of celebration, the date, the place and the services you need." },
  { title: "Compare and message vendors", body: "See who serves your area, their packages and prices, then ask questions in one inbox." },
  { title: "Book with confidence", body: "Request a booking, get the vendor's confirmation and keep every detail in one plan." },
];

/** Stagger position for an element that fades up when its section scrolls into view. */
const at = (i: number) => ({ "--i": Math.min(i, 10) }) as CSSProperties;

const searchHref = (service: string) => `/vendors?service=${encodeURIComponent(service)}`;

export default function Landing() {
  return (
    <main className="min-h-dvh bg-cream">
      {/* Hero */}
      <section className="relative isolate flex min-h-[88dvh] flex-col overflow-hidden bg-navy-900 px-5 text-white lg:min-h-[92dvh] lg:px-10">
        <div aria-hidden="true" className="parallax-hero absolute inset-0 -z-10">
          <Image
            src={hero}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="hero-zoom object-cover object-[70%_center]"
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900 via-navy-900/55 to-navy-900/30 lg:bg-gradient-to-r lg:from-navy-900/95 lg:via-navy-900/60 lg:to-navy-900/0" />

        <header className="mx-auto flex w-full max-w-7xl items-center gap-4 pt-6">
          <div className="flex-1">
            <Logo tone="light" />
          </div>
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-semibold lg:flex">
            <Link href="/vendors" className="press rounded-full px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white">Browse vendors</Link>
            <Link href="#how-it-works" className="press rounded-full px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white">How it works</Link>
            <Link href="#for-vendors" className="press rounded-full px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white">For vendors</Link>
            <Link href="/faq" className="press rounded-full px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white">FAQ</Link>
          </nav>
          <div className="flex flex-1 shrink-0 items-center justify-end gap-2 whitespace-nowrap">
            <LinkButton href="/sign-in" variant="ghost" className="text-white hover:bg-white/10">Log in</LinkButton>
            <span className="hidden sm:block">
              <LinkButton href="/sign-up" variant="secondary" className="border-none">Sign up</LinkButton>
            </span>
          </div>
        </header>

        <div className="mx-auto mt-auto w-full max-w-7xl pb-12 md:mt-0 md:flex md:flex-1 md:items-center md:pb-20 lg:pb-24">
          <div className="hero-in hero-out max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Greater Toronto Area</p>
            <h1 className="mt-3 font-display text-[46px] leading-[1.02] font-bold sm:text-7xl lg:text-[84px]">
              Every celebration,
              <br />
              <span className="text-gold-300">beautifully planned</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/90 sm:text-lg">
              Find trusted planners, photographers, caterers, florists, salons and more, then manage your whole event in
              one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/sign-up" variant="gold" className="pr-4">
                Start planning
                <ArrowBadge tone="dark" />
              </LinkButton>
              <LinkButton href="/vendors" variant="secondary" className="border-none">
                Browse vendors
              </LinkButton>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
              <li className="flex items-center gap-2"><Dot />11 kinds of services</li>
              <li className="flex items-center gap-2"><Dot />Every vendor reviewed by our team</li>
              <li className="flex items-center gap-2"><Dot />Free for clients</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Services */}
      <section aria-labelledby="services" className="px-5 py-16 lg:px-10 lg:py-24">
        <Reveal items className="mx-auto max-w-7xl">
          <div className="reveal-item flex flex-wrap items-end justify-between gap-4" style={at(0)}>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-text uppercase">Services</p>
              <h2 id="services" className="mt-2 font-display text-[34px] leading-tight font-bold sm:text-[44px]">
                Everything your event needs
              </h2>
            </div>
            <Link href="/vendors" className="min-h-11 py-3 text-sm font-semibold text-gold-text hover:underline">
              Browse all vendors →
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <li key={s.name} className={`reveal-item ${i === 0 ? "col-span-2 md:col-span-1 lg:col-span-2 lg:row-span-2" : ""}`} style={at(i + 1)}>
                <Link
                  href={searchHref(s.name)}
                  className="press-soft group relative block h-full min-h-44 overflow-hidden rounded-[20px] bg-navy-900 shadow-card sm:min-h-56"
                >
                  <Image
                    src={s.image}
                    alt=""
                    fill
                    placeholder="blur"
                    sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/25 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex flex-col p-4 text-white sm:p-5">
                    <span className={`font-display font-bold leading-tight ${i === 0 ? "text-[30px] lg:text-[40px]" : "text-[22px]"}`}>{s.name}</span>
                    <span className="mt-1 hidden text-[13px] text-white/85 sm:block">{s.blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
            <li className="reveal-item col-span-2 md:col-span-1 lg:col-span-2" style={at(12)}>
              <Link
                href="/vendors"
                className="press-soft flex h-full min-h-44 flex-col justify-between rounded-[20px] bg-gold-cta p-5 text-navy-900 shadow-card sm:min-h-56"
              >
                <span className="font-display text-[26px] leading-tight font-bold">Not sure where to start?</span>
                <span className="flex items-center justify-between text-sm font-semibold">
                  See who&apos;s near you
                  <ArrowBadge tone="dark" />
                </span>
              </Link>
            </li>
          </ul>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how" className="scroll-mt-6 bg-surface px-5 py-16 lg:px-10 lg:py-24">
        <Reveal items className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="reveal-item relative order-last aspect-[4/3] overflow-hidden rounded-[28px] shadow-float sm:aspect-[16/10] lg:order-first lg:aspect-[4/5]" style={at(1)}>
            <Image src={placeSetting} alt="" fill placeholder="blur" sizes="(min-width: 1024px) 45vw, 100vw" className="scroll-zoom object-cover" />
          </div>
          <div>
            <div className="reveal-item" style={at(0)}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-text uppercase">How it works</p>
              <h2 id="how" className="mt-2 font-display text-[34px] leading-tight font-bold sm:text-[44px]">
                From idea to booked, in one place
              </h2>
            </div>
            <ol className="mt-8 flex flex-col gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="reveal-item flex gap-4" style={at(i + 2)}>
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-gold-300">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-ink-2">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="reveal-item mt-10" style={at(5)}>
              <LinkButton href="/sign-up" variant="navy" className="pr-4">
                Plan my event
                <ArrowBadge />
              </LinkButton>
            </div>
          </div>
        </Reveal>
      </section>

      {/* For vendors */}
      <section id="for-vendors" aria-labelledby="vendors" className="scroll-mt-6 bg-navy-900 px-5 py-16 text-white lg:px-10 lg:py-24">
        <Reveal items className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <div className="reveal-item" style={at(0)}>
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">For vendors</p>
              <h2 id="vendors" className="mt-2 font-display text-[34px] leading-tight font-bold sm:text-[44px]">
                Grow your event business across the GTA
              </h2>
            </div>
            <ul className="mt-8 flex flex-col gap-4 text-white/90">
              {[
                "A profile with your photos, packages and prices",
                "Inquiries from clients who are planning events near you",
                "Quotes, messages and bookings in one inbox",
                "A calendar that shows clients when you're free",
              ].map((line, i) => (
                <li key={line} className="reveal-item flex gap-3" style={at(i + 1)}>
                  <svg aria-hidden="true" className="mt-0.5 shrink-0 text-gold-300" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  {line}
                </li>
              ))}
            </ul>
            <div className="reveal-item mt-10" style={at(5)}>
              <LinkButton href="/sign-up" variant="gold" className="pr-4">
                List your business
                <ArrowBadge tone="dark" />
              </LinkButton>
            </div>
          </div>
          <div className="reveal-item relative aspect-[4/3] overflow-hidden rounded-[28px] sm:aspect-[16/10] lg:aspect-[4/5]" style={at(2)}>
            <Image src={vendorOwner} alt="" fill placeholder="blur" sizes="(min-width: 1024px) 45vw, 100vw" className="scroll-zoom object-cover object-[center_20%]" />
          </div>
        </Reveal>
      </section>

      <LandingTestimonials />

      {/* Closing call to action */}
      <section className="px-5 py-16 lg:px-10 lg:py-24">
        <Reveal className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-navy-900 px-6 py-12 text-center text-white sm:px-12 lg:py-16">
          <Image src={hero} alt="" fill placeholder="blur" sizes="(min-width: 1280px) 1280px, 100vw" className="-z-10 object-cover opacity-30" />
          <h2 className="font-display text-[34px] leading-tight font-bold sm:text-[48px]">Ready to plan something beautiful?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">It&apos;s free to plan your event and message vendors.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/sign-up" variant="gold" className="pr-4">
              Create my free account
              <ArrowBadge tone="dark" />
            </LinkButton>
            <LinkButton href="/vendors" variant="secondary" className="border-none">Browse vendors</LinkButton>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}

function Dot() {
  return <span aria-hidden="true" className="size-1.5 rounded-full bg-gold-300" />;
}
