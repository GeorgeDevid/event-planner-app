import Link from "next/link";

export function Logo({ tone = "dark", suffix }: { tone?: "dark" | "light"; suffix?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-[26px] font-bold leading-none whitespace-nowrap ${
        tone === "dark" ? "text-navy-900" : "text-white"
      }`}
    >
      Event Planner
      {suffix ? <span className="text-gold-300"> {suffix}</span> : null}
    </Link>
  );
}
