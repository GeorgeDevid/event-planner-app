import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your account" };

export default function OnboardingPage() {
  return (
    <main className="min-h-dvh bg-cream px-5 py-10">
      <div className="mx-auto w-full max-w-lg">
        <p className="text-xs font-semibold text-gold-text">Almost there</p>
        <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight">
          How will you use
          <br />
          <span className="text-gold-display">Event Planner?</span>
        </h1>
        <OnboardingForm />
      </div>
    </main>
  );
}
