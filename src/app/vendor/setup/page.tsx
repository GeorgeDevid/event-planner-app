"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { PageHeader, Stepper } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import {
  BusinessDetailsForm,
  CategoriesForm,
  DocumentsForm,
  LocationForm,
} from "@/components/vendor/forms";
import { useMyVendor } from "@/components/vendor/use-vendor";
import { errorMessage } from "@/lib/errors";

const STEPS = ["Business", "Services", "Location", "Documents"] as const;

/** V-01 registration wizard: business → services → location → documents → submit. */
export default function VendorSetup() {
  const vendor = useMyVendor();
  const submit = useMutation(api.vendors.submitForApproval);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (vendor === undefined) return <FullPageLoader />;

  const next = () => {
    setStep((s) => Math.min(s + 1, STEPS.length));
    window.scrollTo({ top: 0 });
  };
  const title = [
    "Tell us about your business",
    "What do you offer?",
    "Where are you based?",
    "Supporting documents",
  ][step - 1];

  const locked = vendor.status === "pending" || vendor.status === "approved";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} backHref="/vendor" eyebrow="Business setup" />
      <Stepper step={step} total={STEPS.length} label={STEPS[step - 1]} />

      {locked ? (
        <FormAlert tone="info">
          Your business has been submitted. Changes you make here update your profile straight
          away.
        </FormAlert>
      ) : null}

      {step === 1 ? <BusinessDetailsForm vendor={vendor} submitLabel="Continue" onSaved={next} /> : null}
      {step === 2 ? <CategoriesForm vendor={vendor} submitLabel="Continue" onSaved={next} /> : null}
      {step === 3 ? <LocationForm vendor={vendor} submitLabel="Continue" onSaved={next} /> : null}
      {step === 4 ? (
        <div className="flex flex-col gap-6">
          <DocumentsForm vendor={vendor} />

          <section aria-labelledby="review" className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-card">
            <h2 id="review" className="text-[17px] font-bold">
              Check your answers
            </h2>
            <ReviewRow label="Business" value={`${vendor.companyName} · ${vendor.ownerName}`} onEdit={() => setStep(1)} />
            <ReviewRow
              label="Services"
              value={vendor.categories.map((c) => c.name).join(", ") || "None chosen"}
              onEdit={() => setStep(2)}
            />
            <ReviewRow
              label="Location"
              value={
                vendor.address
                  ? `${vendor.address}${vendor.clientsComeToMe ? " · clients come to you" : ` · within ${vendor.serviceRadiusKm} km`}`
                  : "Not set"
              }
              onEdit={() => setStep(3)}
            />
          </section>

          {error ? <FormAlert>{error}</FormAlert> : null}
          {locked ? (
            <Button type="button" onClick={() => router.push("/vendor")} className="w-full">
              Back to dashboard
            </Button>
          ) : (
            <Button
              type="button"
              variant="gold"
              className="w-full"
              disabled={pending || !vendor.canSubmit}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await submit();
                  router.push("/vendor");
                } catch (err) {
                  setError(errorMessage(err));
                  setPending(false);
                }
              }}
            >
              {pending ? "Submitting…" : "Submit for approval"}
            </Button>
          )}
          {!vendor.canSubmit && !locked ? (
            <p className="text-center text-sm text-ink-2">
              Add your business details, at least one service and your location to submit.
            </p>
          ) : null}
        </div>
      ) : null}

      {step > 1 ? (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="min-h-11 self-center rounded-full px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2"
        >
          Back to {STEPS[step - 2].toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 border-t border-line pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-2">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 rounded-full px-3 text-sm font-semibold text-gold-text hover:bg-surface-2"
      >
        Edit<span className="sr-only"> {label.toLowerCase()}</span>
      </button>
    </div>
  );
}
