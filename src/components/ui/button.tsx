import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "navy" | "gold" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  navy: "bg-navy-900 text-white shadow-card hover:bg-navy-700",
  gold: "bg-gold-cta text-navy-900 shadow-card hover:brightness-[1.03]",
  secondary:
    "bg-surface text-navy-900 border border-control hover:bg-surface-2",
  ghost: "text-navy-900 hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
};

export function buttonClasses(variant: Variant = "navy", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "navy",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "navy",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}

/** Round arrow used inside primary pills, as in the design. */
export function ArrowBadge({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      className={`-mr-3 flex size-8 items-center justify-center rounded-full ${
        tone === "light" ? "bg-white text-navy-900" : "bg-navy-900 text-white"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
