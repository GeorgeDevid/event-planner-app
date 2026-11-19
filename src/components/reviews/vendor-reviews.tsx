"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { Sheet, TextArea } from "@/components/ui/kit";
import { Stars, StarInput } from "@/components/ui/stars";
import { errorField, errorMessage } from "@/lib/errors";
import { formatIsoDate } from "@/lib/format";

type Mine = NonNullable<FunctionReturnType<typeof api.reviews.forMe>>;

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "America/Toronto" });

/**
 * Reviews on a vendor profile: rating summary, newest reviews with the
 * vendor's replies, and (for clients with a past booking) a button to write or
 * edit their own review. `?review=1` in the URL opens the form straight away,
 * which is where the "booking completed" notification links.
 */
export function VendorReviews({ vendorId, allowWrite = false }: { vendorId: Id<"vendors">; allowWrite?: boolean }) {
  const [limit, setLimit] = useState(5);
  const data = useQuery(api.reviews.forVendor, { vendorId, limit });
  const me = useQuery(api.reviews.forMe, allowWrite ? { vendorId } : "skip");
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const wantsForm = params.get("review") === "1";

  const canWrite = !!me && (me.toReview.length > 0 || me.mine.length > 0);
  // Opened from a "rate this vendor" link: show the form once, until it's closed.
  const [dismissed, setDismissed] = useState(false);
  const sheetOpen = open || (wantsForm && canWrite && !dismissed);
  const close = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (data === undefined) return <div className="h-40 animate-pulse rounded-[20px] bg-surface-2 motion-reduce:animate-none" />;
  if (data === null) return null;

  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-title" className="text-[17px] font-bold">Reviews</h2>
        {canWrite ? (
          <Button type="button" variant={me!.toReview.length > 0 ? "gold" : "secondary"} className="min-h-10 px-4 text-sm" onClick={() => setOpen(true)}>
            {me!.toReview.length > 0 ? "Write a review" : "Edit your review"}
          </Button>
        ) : null}
      </div>

      {data.count === 0 ? (
        <p className="rounded-[20px] bg-surface p-5 text-sm text-ink-2 shadow-card">
          No reviews yet. Clients can review a vendor after their booking date.
        </p>
      ) : (
        <>
          <div className="grid gap-5 rounded-[20px] bg-surface p-5 shadow-card sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex flex-col items-start gap-1 sm:items-center sm:px-4">
              <p className="font-display text-[52px] leading-none font-bold">{data.average?.toFixed(1)}</p>
              <Stars value={data.average ?? 0} size={18} />
              <p className="text-sm text-ink-2">{data.count} review{data.count === 1 ? "" : "s"}</p>
            </div>
            <ul aria-label="Rating breakdown" className="flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = data.breakdown[n - 1];
                const pct = data.count ? Math.round((c / data.count) * 100) : 0;
                return (
                  <li key={n} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-ink-2">{n} star</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-ink-2">{c}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="flex flex-col gap-3">
            {data.items.map((r) => (
              <li key={r._id} className="rounded-[20px] bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size={15} />
                    <span className="text-sm font-semibold">{r.author}{r.mine ? " (you)" : ""}</span>
                  </div>
                  <span className="text-[13px] text-ink-2">
                    {dateFmt.format(r.createdAt)}
                    {r.edited ? " · edited" : ""}
                  </span>
                </div>
                {r.body ? <p className="mt-2 text-[15px] whitespace-pre-line">{r.body}</p> : null}
                {r.reply ? (
                  <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3">
                    <p className="text-xs font-semibold text-ink-2">Reply from the vendor</p>
                    <p className="mt-1 text-sm whitespace-pre-line">{r.reply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {data.hasMore ? (
            <Button type="button" variant="secondary" className="self-start" onClick={() => setLimit(100)}>
              Show all {data.count} reviews
            </Button>
          ) : null}
        </>
      )}

      {me ? (
        <Sheet open={sheetOpen} onClose={close} title={me.toReview.length > 0 ? "Write a review" : "Edit your review"}>
          <ReviewForm me={me} onDone={close} />
        </Sheet>
      ) : null}
    </section>
  );
}

function ReviewForm({ me, onDone }: { me: Mine; onDone: () => void }) {
  const submit = useMutation(api.reviews.submit);
  const remove = useMutation(api.reviews.remove);
  // Bookings still to review come first, then reviews already written.
  const options = [
    ...me.toReview.map((b) => ({ bookingId: b.bookingId, serviceDate: b.serviceDate, review: null as Mine["mine"][number] | null })),
    ...me.mine.map((r) => ({ bookingId: r.bookingId, serviceDate: r.serviceDate, review: r })),
  ];
  const [bookingId, setBookingId] = useState<Id<"bookings">>(options[0].bookingId);
  const current = options.find((o) => o.bookingId === bookingId) ?? options[0];
  const [rating, setRating] = useState(current.review?.rating ?? 0);
  const [body, setBody] = useState(current.review?.body ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function pick(id: Id<"bookings">) {
    const o = options.find((x) => x.bookingId === id);
    setBookingId(id);
    setRating(o?.review?.rating ?? 0);
    setBody(o?.review?.body ?? "");
    setErrors({});
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) {
          setErrors({ rating: "Pick a star rating." });
          return;
        }
        setPending(true);
        setErrors({});
        try {
          await submit({ bookingId, rating, body: body.trim() || undefined });
          onDone();
        } catch (err) {
          setErrors({ [errorField(err) ?? "form"]: errorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      {errors.form ? <FormAlert>{errors.form}</FormAlert> : null}
      {options.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-booking" className="text-xs font-semibold text-ink-2">Booking</label>
          <select
            id="review-booking"
            value={bookingId}
            onChange={(e) => pick(e.target.value as Id<"bookings">)}
            className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
          >
            {options.map((o) => (
              <option key={o.bookingId} value={o.bookingId}>
                {o.serviceDate ? formatIsoDate(o.serviceDate, { weekday: false }) : "Booking"}
                {o.review ? " (reviewed)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : current.serviceDate ? (
        <p className="text-sm text-ink-2">Your booking on {formatIsoDate(current.serviceDate, { weekday: false })}</p>
      ) : null}
      {current.review?.hidden ? (
        <FormAlert tone="info">Our team hid this review{current.review.hiddenReason ? `: ${current.review.hiddenReason}` : "."} Editing it doesn&apos;t make it visible again.</FormAlert>
      ) : null}
      <StarInput value={rating} onChange={setRating} label="Your rating" error={errors.rating} />
      <TextArea
        id="review-body"
        label="Your review (optional)"
        helper="What went well? Anything others should know?"
        maxLength={1000}
        value={body}
        error={errors.body}
        onChange={(e) => setBody(e.target.value)}
      />
      <p className="text-[13px] text-ink-2">Your first name and last initial show with your review.</p>
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Saving…" : current.review ? "Save changes" : "Post review"}</Button>
      {current.review ? (
        <Button
          type="button"
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await remove({ reviewId: current.review!._id });
              onDone();
            } catch (err) {
              setErrors({ form: errorMessage(err) });
            } finally {
              setPending(false);
            }
          }}
        >
          Delete my review
        </Button>
      ) : null}
    </form>
  );
}
