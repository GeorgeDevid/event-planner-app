"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Sheet, TextArea } from "@/components/ui/kit";
import { errorMessage } from "@/lib/errors";

const REASONS = ["Spam or scam", "Inappropriate content", "Harassment", "Fake or misleading", "Other"];

/** Report a vendor or a conversation to moderation (C-10 #5, C-13 #4). */
export function ReportSheet({
  open,
  onClose,
  title,
  target,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  target: { targetType: "vendor"; vendorId: Id<"vendors"> } | { targetType: "conversation"; inquiryId: Id<"inquiries"> };
}) {
  const create = useMutation(api.reports.create);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        setSent(false);
        setError(null);
      }}
      title={title}
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-[15px]">Thanks. Our team will review it, and we&apos;ll let you know once it&apos;s been looked at.</p>
          <Button type="button" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (!reason) {
              setError("Choose a reason.");
              return;
            }
            setPending(true);
            try {
              await create({ ...target, reason, details: details.trim() || undefined });
              setSent(true);
              setReason("");
              setDetails("");
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setPending(false);
            }
          }}
        >
          <p className="text-sm text-ink-2">Reports go to our moderation team. The other person isn&apos;t told who reported them.</p>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[15px] font-semibold">What&apos;s wrong?</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-surface-2 px-4 has-[:checked]:bg-navy-900 has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-text">
                <input type="radio" name="report-reason" className="sr-only" checked={reason === r} onChange={() => setReason(r)} />
                <span className="text-sm font-semibold">{r}</span>
              </label>
            ))}
          </fieldset>
          <TextArea
            id="report-details"
            label={reason === "Other" ? "Details" : "Details (optional)"}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <Button type="submit" variant="danger" disabled={pending}>{pending ? "Sending…" : "Send report"}</Button>
        </form>
      )}
    </Sheet>
  );
}
