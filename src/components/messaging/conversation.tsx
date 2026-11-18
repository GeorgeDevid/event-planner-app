"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ReportSheet } from "@/components/messaging/report-sheet";
import { Button, LinkButton } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { PageHeader, Sheet, TextArea } from "@/components/ui/kit";
import { FullPageLoader } from "@/components/ui/loader";
import { errorMessage } from "@/lib/errors";
import { formatBudget, formatCents, formatIsoDate, formatPrice, parseDollars, torontoTodayIso } from "@/lib/format";
import { checkFile, uploadToConvex } from "@/lib/upload";

type Thread = FunctionReturnType<typeof api.inquiries.thread>;
type Booking = Thread["bookings"][number];

export const INQUIRY_STATUS: Record<string, string> = {
  sent: "Sent",
  quoted: "Quoted",
  declined: "Declined",
  closed: "Closed",
};
export const BOOKING_STATUS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};
const PAYMENT_NOTE = "Payment is arranged directly with the vendor. The app doesn't process payments.";

const time = (ms: number) =>
  new Date(ms).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One inquiry's thread for the client or the vendor (C-12 to C-14, V-06, V-07). */
export function Conversation({ inquiryId, backHref }: { inquiryId: Id<"inquiries">; backHref: string }) {
  const thread = useQuery(api.inquiries.thread, { inquiryId });
  const markRead = useMutation(api.inquiries.markRead);
  const endRef = useRef<HTMLDivElement>(null);
  const count = thread?.messages.length ?? 0;

  useEffect(() => {
    if (thread && thread.role !== "admin") void markRead({ inquiryId }).catch(() => {});
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, inquiryId, markRead, thread]);

  if (thread === undefined) return <FullPageLoader />;

  const isClient = thread.role === "client";
  const other = isClient ? thread.vendor.companyName : thread.client.name;
  const open = thread.status === "sent" || thread.status === "quoted";
  const canWrite = open || (thread.status === "declined" && !isClient);

  return (
    <div className="flex flex-col gap-4 pb-40">
      <PageHeader
        title={other}
        eyebrow={`${INQUIRY_STATUS[thread.status]}${thread.details?.category ? ` · ${thread.details.category}` : ""}`}
        backHref={backHref}
        action={
          isClient ? (
            <Link href={`/app/vendors/${thread.vendor._id}`} className="min-h-11 rounded-full px-3 py-3 text-sm font-semibold text-gold-text">
              Profile
            </Link>
          ) : null
        }
      />
      <DetailsCard thread={thread} />
      <ThreadActions thread={thread} />

      {thread.bookings.length > 0 ? (
        <section aria-label="Bookings" className="flex flex-col gap-2">
          {thread.bookings.map((b) => (
            <BookingCard key={b._id} booking={b} role={thread.role} />
          ))}
        </section>
      ) : null}

      <ol aria-label="Messages" className="flex flex-col gap-3">
        {thread.messages.map((m) => (
          <li key={m._id} className={m.from === "system" ? "self-center" : m.mine ? "self-end" : "self-start"}>
            {m.from === "system" ? (
              <p className="max-w-[320px] rounded-full bg-surface-2 px-4 py-2 text-center text-xs text-ink-2">
                {m.body} · {time(m.createdAt)}
              </p>
            ) : (
              <div className="flex max-w-[300px] flex-col gap-1">
                <div className={`rounded-[20px] px-4 py-3 ${m.mine ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md bg-surface shadow-card"}`}>
                  {m.removed ? (
                    <p className="text-sm italic opacity-75">This message was removed by a moderator.</p>
                  ) : (
                    <>
                      {m.quote ? (
                        <div className={`mb-2 rounded-2xl p-3 ${m.mine ? "bg-navy-700" : "bg-surface-2"}`}>
                          <p className={`text-xs font-semibold ${m.mine ? "text-gold-300" : "text-gold-text"}`}>Quote</p>
                          <p className="text-[22px] font-bold">{formatCents(m.quote.priceCents)}</p>
                          {m.quote.packageName ? <p className="text-sm">{m.quote.packageName}</p> : null}
                          {m.quote.validUntil ? (
                            <p className={`text-xs ${m.mine ? "text-on-navy-2" : "text-ink-2"}`}>Valid until {formatIsoDate(m.quote.validUntil)}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {m.body ? <p className="text-[15px] whitespace-pre-line">{m.body}</p> : null}
                      {m.images.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {m.images.map((url, i) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-xl">
                              <Image src={url} alt={`Attached photo ${i + 1}`} fill sizes="150px" className="object-cover" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <p className={`px-1 text-[11px] text-ink-2 ${m.mine ? "text-right" : ""}`}>
                  {time(m.createdAt)}
                  {m.mine ? (m.read ? " · Read" : " · Sent") : ""}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      {thread.role !== "admin" ? (
        canWrite ? (
          <Composer inquiryId={inquiryId} />
        ) : (
          <p className="rounded-[20px] bg-surface-2 p-4 text-center text-sm text-ink-2">
            This conversation is {INQUIRY_STATUS[thread.status].toLowerCase()}.
            {isClient && thread.vendor.available ? (
              <>
                {" "}
                <Link className="font-semibold text-gold-text" href={`/app/vendors/${thread.vendor._id}/inquire`}>
                  Start a new inquiry
                </Link>
              </>
            ) : null}
          </p>
        )
      ) : null}
    </div>
  );
}

function DetailsCard({ thread }: { thread: Thread }) {
  const d = thread.details;
  if (!d) return null;
  const budget = formatBudget(d.budgetMinCents, d.budgetMaxCents);
  const facts = [
    d.eventName ? ["Event", d.eventName] : null,
    d.eventType ? ["Type", d.eventType] : null,
    d.date ? ["Date", formatIsoDate(d.date)] : null,
    d.guestCount ? ["Guests", String(d.guestCount)] : null,
    d.location ? ["Location", d.location.split(",").slice(0, 2).join(",")] : null,
    budget ? ["Budget", budget] : null,
  ].filter((x): x is string[] => !!x);
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[20px] bg-surface p-4 text-sm shadow-card">
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-ink-2">{k}</dt>
          <dd className="truncate font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ThreadActions({ thread }: { thread: Thread }) {
  const close = useMutation(api.inquiries.close);
  const decline = useMutation(api.inquiries.decline);
  const [sheet, setSheet] = useState<"quote" | "decline" | "report" | "close" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = thread.status === "sent" || thread.status === "quoted";
  if (thread.role === "admin") return null;
  const isClient = thread.role === "client";
  const hasLiveBooking = thread.bookings.some((b) => b.status === "pending" || b.status === "accepted");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isClient && open && thread.vendor.available && !hasLiveBooking ? (
          <LinkButton
            href={`/app/vendors/${thread.vendor._id}/book${thread.eventId ? `?event=${thread.eventId}` : ""}`}
            variant="gold"
            className="min-h-10 px-4 text-sm"
          >
            Request booking
          </LinkButton>
        ) : null}
        {!isClient && open ? (
          <>
            <Button type="button" variant="gold" className="min-h-10 px-4 text-sm" onClick={() => setSheet("quote")}>Send quote</Button>
            <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setSheet("decline")}>Decline</Button>
          </>
        ) : null}
        {isClient && open ? (
          <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setSheet("close")}>Close</Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 px-3 text-sm text-ink-2"
          disabled={thread.reported}
          onClick={() => setSheet("report")}
        >
          {thread.reported ? "Reported" : "Report"}
        </Button>
      </div>

      <Sheet open={sheet === "quote"} onClose={() => setSheet(null)} title="Send a quote">
        <QuoteForm thread={thread} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === "decline"} onClose={() => setSheet(null)} title="Decline this inquiry?">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await decline({ inquiryId: thread._id, reason: reason.trim() || undefined });
              setSheet(null);
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <p className="text-sm text-ink-2">{thread.client.name} is told you declined. You can still message them.</p>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <TextArea id="decline-reason" label="Reason (optional)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger">Decline inquiry</Button>
        </form>
      </Sheet>
      <Sheet open={sheet === "close"} onClose={() => setSheet(null)} title="Close this conversation?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            {thread.vendor.companyName} is told you&apos;ve closed it. You can start a new inquiry later.
          </p>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button
            type="button"
            onClick={async () => {
              setError(null);
              try {
                await close({ inquiryId: thread._id });
                setSheet(null);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Close conversation
          </Button>
        </div>
      </Sheet>
      <ReportSheet
        open={sheet === "report"}
        onClose={() => setSheet(null)}
        title="Report this conversation"
        target={{ targetType: "conversation", inquiryId: thread._id }}
      />
    </>
  );
}

function QuoteForm({ thread, onDone }: { thread: Thread; onDone: () => void }) {
  const send = useMutation(api.inquiries.sendQuote);
  const [packageId, setPackageId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const cents = parseDollars(price);
        if (!cents) {
          setError("Enter the price in dollars, like 2400.");
          return;
        }
        setPending(true);
        try {
          await send({
            inquiryId: thread._id,
            packageId: (packageId || undefined) as Id<"packages"> | undefined,
            priceCents: cents,
            notes: notes.trim() || undefined,
            validUntil: validUntil || undefined,
          });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {error ? <FormAlert>{error}</FormAlert> : null}
      {thread.packages.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-2">Package (optional)</span>
          <select
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value);
              const p = thread.packages.find((x) => x._id === e.target.value);
              if (p && !price) setPrice(String(p.priceCents / 100));
            }}
            className="h-[52px] rounded-2xl border border-control bg-surface px-4 text-[15px]"
          >
            <option value="">Custom quote</option>
            {thread.packages.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} · {formatPrice(p)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <TextField id="quote-price" label="Price (CAD)" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />
      <TextArea id="quote-notes" label="Notes (optional)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} helper="What's included, deposit terms, and so on." />
      <TextField id="quote-valid" label="Valid until (optional)" type="date" min={torontoTodayIso()} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Sending…" : "Send quote"}</Button>
    </form>
  );
}

function BookingCard({ booking: b, role }: { booking: Booking; role: Thread["role"] }) {
  const respond = useMutation(api.bookings.respond);
  const complete = useMutation(api.bookings.complete);
  const cancel = useMutation(api.bookings.cancel);
  const [sheet, setSheet] = useState<"decline" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setSheet(null);
      setReason("");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const tone =
    b.status === "accepted" || b.status === "completed"
      ? "bg-success-bg text-success"
      : b.status === "pending"
        ? "bg-gold-300/40 text-navy-900"
        : "bg-surface-2 text-ink-2";

  return (
    <article className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink-2">Booking request</p>
          <p className="text-[17px] font-bold">{formatIsoDate(b.serviceDate)}</p>
          <p className="text-sm text-ink-2">
            {[b.packageName, b.agreedPriceCents ? formatCents(b.agreedPriceCents) : null].filter(Boolean).join(" · ") || "No package chosen"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{BOOKING_STATUS[b.status]}</span>
      </div>
      {b.notes ? <p className="text-sm whitespace-pre-line">{b.notes}</p> : null}
      {b.statusReason ? <p className="text-sm text-ink-2">Reason: {b.statusReason}</p> : null}
      <p className="text-xs text-ink-2">{PAYMENT_NOTE}</p>
      {error && !sheet ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        {role === "vendor" && b.status === "pending" ? (
          <>
            <Button type="button" variant="gold" className="min-h-10 px-4 text-sm" onClick={() => run(() => respond({ bookingId: b._id, accept: true }))}>Accept</Button>
            <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setSheet("decline")}>Decline</Button>
          </>
        ) : null}
        {role === "vendor" && b.status === "accepted" && b.past ? (
          <Button type="button" variant="navy" className="min-h-10 px-4 text-sm" onClick={() => run(() => complete({ bookingId: b._id }))}>Mark completed</Button>
        ) : null}
        {(role === "client" && (b.status === "pending" || b.status === "accepted")) || (role === "vendor" && b.status === "accepted") ? (
          <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => setSheet("cancel")}>Cancel booking</Button>
        ) : null}
      </div>

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === "decline" ? "Decline this booking?" : "Cancel this booking?"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              sheet === "decline"
                ? respond({ bookingId: b._id, accept: false, reason })
                : cancel({ bookingId: b._id, reason }),
            );
          }}
        >
          <p className="text-sm text-ink-2">
            {sheet === "decline"
              ? "The client sees your reason and can choose another vendor."
              : role === "vendor"
                ? "The client and our team are told. Cancelling accepted bookings affects your standing."
                : "The vendor is told, and the date is freed up on their calendar."}
          </p>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <TextArea id="booking-reason" label="Reason" maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="danger" disabled={reason.trim().length < 3}>
            {sheet === "decline" ? "Decline booking" : "Cancel booking"}
          </Button>
        </form>
      </Sheet>
    </article>
  );
}

function Composer({ inquiryId }: { inquiryId: Id<"inquiries"> }) {
  const send = useMutation(api.inquiries.sendMessage);
  const generateUploadUrl = useMutation(api.inquiries.generateUploadUrl);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!text.trim() && files.length === 0) return;
    setError(null);
    setPending(true);
    try {
      const imageIds: Id<"_storage">[] = [];
      for (const f of files) imageIds.push(await uploadToConvex(() => generateUploadUrl(), f));
      await send({ inquiryId, body: text, imageIds: imageIds.length ? imageIds : undefined });
      setText("");
      setFiles([]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="fixed inset-x-3 bottom-24 z-20 mx-auto flex max-w-md flex-col gap-2 rounded-[24px] bg-surface p-2 shadow-float"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? <p className="px-2 text-[13px] font-medium text-danger">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 px-2 pt-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-xs">
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="flex size-7 items-center justify-center rounded-full hover:bg-line">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="sr-only"
          id="attach"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const f of picked) {
              const problem =
                f.type !== "image/jpeg" && f.type !== "image/png"
                  ? `${f.name}: use a JPG or PNG photo.`
                  : checkFile(f, "image");
              if (problem) {
                setError(problem);
                return;
              }
            }
            setFiles((x) => [...x, ...picked].slice(0, 4));
          }}
        />
        <label htmlFor="attach" aria-label="Attach photos" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
        </label>
        <label htmlFor="message" className="sr-only">Message</label>
        <textarea
          id="message"
          rows={1}
          value={text}
          maxLength={2000}
          placeholder="Write a message…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2.5 text-[15px] focus:outline-none focus-visible:outline-3 focus-visible:outline-gold-text"
        />
        <Button type="submit" className="size-11 shrink-0 px-0" aria-label="Send" disabled={pending || (!text.trim() && files.length === 0)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Button>
      </div>
    </form>
  );
}
