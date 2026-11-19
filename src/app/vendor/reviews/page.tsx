"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { PageHeader, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { Stars } from "@/components/ui/stars";
import { errorMessage } from "@/lib/errors";
import { formatIsoDate } from "@/lib/format";

type Item = FunctionReturnType<typeof api.reviews.vendorMine>["items"][number];

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

/** A vendor's reviews from clients, with a public reply under each. */
export default function VendorReviewsPage() {
  const data = useQuery(api.reviews.vendorMine);
  if (data === undefined) return <FullPageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reviews" backHref="/vendor" />
      <div className="flex items-center gap-5 rounded-[20px] bg-surface p-5 shadow-card">
        <p className="font-display text-[52px] leading-none font-bold">{data.average !== null ? data.average.toFixed(1) : "—"}</p>
        <div>
          <Stars value={data.average ?? 0} size={18} />
          <p className="mt-1 text-sm text-ink-2">
            {data.count > 0 ? `From ${data.count} review${data.count === 1 ? "" : "s"}` : "No reviews yet"}
          </p>
        </div>
      </div>
      {data.items.length === 0 ? (
        <p className="rounded-[20px] bg-surface p-6 text-center text-sm text-ink-2 shadow-card">
          Clients can review you after a booking date has passed. Marking bookings as completed reminds them.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((r) => (
            <li key={r._id}>
              <ReviewItem r={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({ r }: { r: Item }) {
  const reply = useMutation(api.reviews.reply);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.reply ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(value: string) {
    setPending(true);
    setError(null);
    try {
      await reply({ reviewId: r._id, text: value });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-[20px] bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stars value={r.rating} size={15} />
          <span className="text-sm font-semibold">{r.author}</span>
        </div>
        <span className="text-[13px] text-ink-2">
          {dateFmt.format(r.createdAt)}
          {r.serviceDate ? ` · booking ${formatIsoDate(r.serviceDate, { weekday: false })}` : ""}
        </span>
      </div>
      {r.hidden ? (
        <p className="rounded-2xl bg-muted-bg px-3 py-2 text-[13px] font-medium text-muted">Hidden by our team. It isn&apos;t shown on your profile or counted in your rating.</p>
      ) : null}
      {r.body ? <p className="text-[15px] whitespace-pre-line">{r.body}</p> : <p className="text-sm text-ink-2">No written review.</p>}
      {error ? <FormAlert>{error}</FormAlert> : null}
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(text);
          }}
        >
          <TextArea id={`reply-${r._id}`} label="Your public reply" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="navy" className="min-h-10 px-4 text-sm" disabled={pending || !text.trim()}>{pending ? "Saving…" : "Post reply"}</Button>
            <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => { setEditing(false); setText(r.reply ?? ""); }}>Cancel</Button>
          </div>
        </form>
      ) : r.reply ? (
        <div className="rounded-2xl bg-surface-2 px-4 py-3">
          <p className="text-xs font-semibold text-ink-2">Your reply</p>
          <p className="mt-1 text-sm whitespace-pre-line">{r.reply}</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className="min-h-11 text-sm font-semibold text-gold-text" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="min-h-11 text-sm font-semibold text-danger" disabled={pending} onClick={() => void save("")}>Remove</button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" className="min-h-10 self-start px-4 text-sm" onClick={() => setEditing(true)}>Reply</Button>
      )}
    </article>
  );
}
