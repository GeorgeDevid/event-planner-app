"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { homeFor } from "@/components/shell/role-gate";
import { takeNext } from "@/lib/next-path";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { FullPageLoader } from "@/components/ui/loader";

type AccountType = "client" | "vendor";

const OPTIONS: { value: AccountType; title: string; body: string }[] = [
  {
    value: "client",
    title: "I'm planning an event",
    body: "Find and book vendors for a wedding, birthday or any celebration, or book a single service.",
  },
  {
    value: "vendor",
    title: "I offer event services",
    body: "List your business, share your work and receive inquiries. An admin reviews new businesses first.",
  },
];

export function OnboardingForm() {
  const me = useQuery(api.users.me);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>("client");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already set up (or signed out): go where this person belongs.
  useEffect(() => {
    if (me === null) router.replace("/sign-in");
    else if (me?.onboarded) router.replace(homeFor(me));
  }, [me, router]);

  if (!me || me.onboarded) return <FullPageLoader />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { role } = await completeOnboarding({
        name,
        accountType,
        companyName: accountType === "vendor" ? companyName : undefined,
        phone: accountType === "vendor" ? phone : undefined,
      });
      router.replace(role === "vendor" ? "/vendor" : (takeNext("/app") ?? "/app"));
    } catch (err) {
      setError(
        err instanceof ConvexError && typeof err.data?.message === "string"
          ? err.data.message
          : "Something went wrong. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      {error ? <FormAlert>{error}</FormAlert> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Account type</legend>
        {OPTIONS.map((option) => {
          const selected = accountType === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-4 rounded-[20px] border-2 bg-surface p-5 shadow-card transition-colors ${
                selected ? "border-navy-900" : "border-transparent"
              }`}
            >
              <input
                type="radio"
                name="accountType"
                value={option.value}
                checked={selected}
                onChange={() => setAccountType(option.value)}
                className="mt-1 size-5 accent-navy-900"
              />
              <span className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">{option.title}</span>
                <span className="text-sm text-ink-2">{option.body}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <TextField
        id="name"
        label="Your name"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
      />

      {accountType === "vendor" ? (
        <>
          <TextField
            id="companyName"
            label="Company name"
            autoComplete="organization"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={pending}
          />
          <TextField
            id="phone"
            type="tel"
            label="Business phone (optional)"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={pending}
          />
        </>
      ) : null}

      <Button type="submit" variant="gold" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
