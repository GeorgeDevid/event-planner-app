"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminHeader, Drawer, formatDateTime, Tabs } from "@/components/admin/ui";
import { BannerCard } from "@/components/content/banners";
import { TestimonialCard } from "@/components/content/testimonials";
import { Stars, StarInput } from "@/components/ui/stars";
import { FaqItems } from "@/components/content/faq-list";
import { LegalText } from "@/components/content/legal-text";
import { useMe } from "@/components/shell/role-gate";
import { Button } from "@/components/ui/button";
import { FormAlert, TextField } from "@/components/ui/field";
import { Switch, TextArea } from "@/components/ui/kit";
import { errorField, errorMessage } from "@/lib/errors";
import { formatIsoDate } from "@/lib/format";
import { uploadToConvex } from "@/lib/upload";

type Data = FunctionReturnType<typeof api.content.adminAll>;
type Tab = "banners" | "faqs" | "reviews" | "terms" | "privacy";

/** A-09: banners, FAQs, app reviews, Terms and Privacy. Drafts are previewed before publishing. */
export default function ContentPage() {
  const me = useMe();
  const data = useQuery(api.content.adminAll);
  const [tab, setTab] = useState<Tab>("banners");
  const can = (p: string) => me.permissions.includes(p as never);
  if (data === undefined) return <p className="text-sm text-ink-2">Loading…</p>;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminHeader title="Site" accent="content" description="Changes stay as drafts until you publish them." />
      <Tabs
        label="Content"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "banners", label: "Home banners", count: data.banners.length },
          { value: "faqs", label: "FAQs", count: data.faqs.length },
          { value: "reviews", label: "App reviews", count: data.testimonials.length },
          { value: "terms", label: "Terms of Service" },
          { value: "privacy", label: "Privacy Policy" },
        ]}
      />
      {tab === "banners" ? <Banners data={data} can={can} /> : null}
      {tab === "faqs" ? <Faqs data={data} can={can} /> : null}
      {tab === "reviews" ? <Reviews data={data} can={can} /> : null}
      {tab === "terms" || tab === "privacy" ? <Legal key={tab} kind={tab} doc={data[tab]} canEdit={can("content:edit")} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Banners({ data, can }: { data: Data; can: (p: string) => boolean }) {
  const setPublished = useMutation(api.content.setBannerPublished);
  const move = useMutation(api.content.moveItem);
  const remove = useMutation(api.content.removeBanner);
  const [editing, setEditing] = useState<Data["banners"][number] | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Shown at the top of the client home, in this order, between their start and end dates.</p>
        {can("content:create") ? <Button type="button" variant="gold" onClick={() => setEditing("new")}>New banner</Button> : null}
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {data.banners.length === 0 ? <p className="rounded-[20px] bg-surface p-6 text-center text-sm text-ink-2 shadow-card">No banners yet.</p> : null}
      <ol className="flex flex-col gap-3">
        {data.banners.map((b, i) => {
          const live = b.published && (!b.startsOn || b.startsOn <= today) && (!b.endsOn || b.endsOn >= today);
          return (
            <li key={b._id} className="grid gap-4 rounded-[20px] bg-surface p-4 shadow-card md:grid-cols-[280px_1fr]">
              <BannerCard banner={{ _id: b._id, title: b.title, body: b.body ?? null, linkUrl: b.linkUrl ?? null, linkLabel: b.linkLabel ?? null, imageUrl: b.imageUrl }} />
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  <span className={`mr-2 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-success-bg text-success" : "bg-surface-2 text-ink-2"}`}>
                    {live ? "Live" : b.published ? "Scheduled or ended" : "Draft"}
                  </span>
                  {b.startsOn || b.endsOn ? `${b.startsOn ? formatIsoDate(b.startsOn, { weekday: false }) : "Now"} – ${b.endsOn ? formatIsoDate(b.endsOn, { weekday: false }) : "no end"}` : "No dates"}
                </p>
                {can("content:edit") ? (
                  <Switch checked={b.published} label="Published" onChange={(published) => setPublished({ bannerId: b._id, published }).catch((e) => setError(errorMessage(e)))} />
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2">
                  {can("content:edit") ? (
                    <>
                      <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setEditing(b)}>Edit</Button>
                      <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move up" disabled={i === 0} onClick={() => move({ table: "banners", id: b._id, direction: "up" })}>▲</Button>
                      <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move down" disabled={i === data.banners.length - 1} onClick={() => move({ table: "banners", id: b._id, direction: "down" })}>▼</Button>
                    </>
                  ) : null}
                  {can("content:delete") ? (
                    <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => window.confirm("Delete this banner?") && remove({ bannerId: b._id }).catch((e) => setError(errorMessage(e)))}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New banner" : "Edit banner"}>
        {editing ? <BannerForm banner={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Drawer>
    </section>
  );
}

function BannerForm({ banner, onDone }: { banner: Data["banners"][number] | null; onDone: () => void }) {
  const save = useMutation(api.content.saveBanner);
  const upload = useMutation(api.content.generateUploadUrl);
  const [f, setF] = useState({
    title: banner?.title ?? "",
    body: banner?.body ?? "",
    linkUrl: banner?.linkUrl ?? "",
    linkLabel: banner?.linkLabel ?? "",
    startsOn: banner?.startsOn ?? "",
    endsOn: banner?.endsOn ?? "",
  });
  const [imageId, setImageId] = useState<Id<"_storage"> | undefined>(banner?.imageId);
  const [imageUrl, setImageUrl] = useState<string | null>(banner?.imageUrl ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErrors({});
        setPending(true);
        try {
          await save({
            bannerId: banner?._id,
            title: f.title,
            body: f.body || undefined,
            imageId,
            linkUrl: f.linkUrl || undefined,
            linkLabel: f.linkLabel || undefined,
            startsOn: f.startsOn || undefined,
            endsOn: f.endsOn || undefined,
          });
          onDone();
        } catch (err) {
          setErrors({ [errorField(err) ?? "form"]: errorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-xs font-semibold text-ink-2">Preview</p>
      <BannerCard banner={{ _id: "preview", title: f.title || "Banner title", body: f.body || null, linkUrl: f.linkUrl || null, linkLabel: f.linkLabel || null, imageUrl }} />
      {errors.form ? <FormAlert>{errors.form}</FormAlert> : null}
      <TextField id="b-title" label="Title" maxLength={80} value={f.title} error={errors.title} onChange={set("title")} />
      <TextArea id="b-body" label="Text (optional)" maxLength={240} value={f.body} error={errors.body} onChange={set("body")} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="b-image" className="text-xs font-semibold text-ink-2">Image (optional, JPG, PNG or WebP up to 5 MB)</label>
        <input
          id="b-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setImageId(await uploadToConvex(() => upload(), file));
              setImageUrl(URL.createObjectURL(file));
            } catch (err) {
              setErrors({ form: errorMessage(err) });
            }
          }}
        />
        {imageId ? (
          <button type="button" className="self-start text-sm font-semibold text-danger" onClick={() => { setImageId(undefined); setImageUrl(null); }}>Remove image</button>
        ) : null}
      </div>
      <div className="flex gap-3">
        <TextField id="b-link" label="Link (optional)" placeholder="/app/search or https://…" className="flex-1" value={f.linkUrl} error={errors.linkUrl} onChange={set("linkUrl")} />
        <TextField id="b-label" label="Button text" className="w-40" value={f.linkLabel} error={errors.linkLabel} onChange={set("linkLabel")} />
      </div>
      <div className="flex gap-3">
        <TextField id="b-start" label="Start date (optional)" type="date" className="flex-1" value={f.startsOn} error={errors.startsOn} onChange={set("startsOn")} />
        <TextField id="b-end" label="End date (optional)" type="date" className="flex-1" value={f.endsOn} error={errors.endsOn} onChange={set("endsOn")} />
      </div>
      <p className="text-sm text-ink-2">{banner ? "Saving updates the banner; it stays published or unpublished as it is." : "New banners are saved as drafts. Publish from the list when ready."}</p>
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Saving…" : "Save banner"}</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

type Review = Data["testimonials"][number];

function Reviews({ data, can }: { data: Data; can: (p: string) => boolean }) {
  const setPublished = useMutation(api.content.setTestimonialPublished);
  const move = useMutation(api.content.moveItem);
  const remove = useMutation(api.content.removeTestimonial);
  const [editing, setEditing] = useState<Review | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = data.testimonials;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Published reviews show in the &ldquo;What people say&rdquo; section of the landing page, in this order. Only add
          reviews real customers gave you, with their permission.
        </p>
        {can("content:create") ? <Button type="button" variant="gold" onClick={() => setEditing("new")}>New review</Button> : null}
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {rows.length === 0 ? <p className="rounded-[20px] bg-surface p-6 text-center text-sm text-ink-2 shadow-card">No reviews yet. The landing page hides the section until one is published.</p> : null}
      <ol className="flex flex-col gap-3">
        {rows.map((t, i) => (
          <li key={t._id} className="flex flex-wrap items-center gap-4 rounded-[20px] bg-surface p-4 shadow-card">
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={t.rating} size={14} />
                <p className="font-semibold">{t.name}</p>
                {t.detail ? <p className="text-sm text-ink-2">· {t.detail}</p> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-2">{t.quote}</p>
            </div>
            {can("content:edit") ? (
              <>
                <div className="w-36">
                  <Switch checked={t.published} label={t.published ? "Published" : "Draft"} onChange={(published) => setPublished({ testimonialId: t._id, published }).catch((e) => setError(errorMessage(e)))} />
                </div>
                <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setEditing(t)}>Edit</Button>
                <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move up" disabled={i === 0} onClick={() => move({ table: "testimonials", id: t._id, direction: "up" })}>▲</Button>
                <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move({ table: "testimonials", id: t._id, direction: "down" })}>▼</Button>
              </>
            ) : null}
            {can("content:delete") ? (
              <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => window.confirm(`Delete the review from ${t.name}?`) && remove({ testimonialId: t._id }).catch((e) => setError(errorMessage(e)))}>
                Delete
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New review" : "Edit review"}>
        {editing ? <ReviewForm review={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Drawer>
    </section>
  );
}

function ReviewForm({ review, onDone }: { review: Review | null; onDone: () => void }) {
  const save = useMutation(api.content.saveTestimonial);
  const [f, setF] = useState({ name: review?.name ?? "", detail: review?.detail ?? "", quote: review?.quote ?? "" });
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErrors({});
        setPending(true);
        try {
          await save({ testimonialId: review?._id, name: f.name, detail: f.detail || undefined, quote: f.quote, rating });
          onDone();
        } catch (err) {
          setErrors({ [errorField(err) ?? "form"]: errorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-xs font-semibold text-ink-2">Preview</p>
      <TestimonialCard t={{ _id: "preview", name: f.name || "Reviewer name", detail: f.detail || null, quote: f.quote || "Their review appears here.", rating }} />
      {errors.form ? <FormAlert>{errors.form}</FormAlert> : null}
      <StarInput value={rating} onChange={setRating} error={errors.rating} />
      <TextField id="t-name" label="Name" maxLength={80} value={f.name} error={errors.name} onChange={set("name")} helper="As the reviewer agreed to be shown, e.g. Priya S." />
      <TextField id="t-detail" label="Detail (optional)" maxLength={80} value={f.detail} error={errors.detail} onChange={set("detail")} helper="e.g. Wedding in Mississauga, or Florist, Brampton" />
      <TextArea id="t-quote" label="Review" maxLength={600} value={f.quote} error={errors.quote} onChange={set("quote")} />
      <p className="text-sm text-ink-2">{review ? "Saving keeps it published or unpublished as it is." : "New reviews are saved as drafts. Publish from the list when ready."}</p>
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Saving…" : "Save review"}</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Faqs({ data, can }: { data: Data; can: (p: string) => boolean }) {
  const save = useMutation(api.content.saveFaq);
  const setPublished = useMutation(api.content.setFaqPublished);
  const move = useMutation(api.content.moveItem);
  const remove = useMutation(api.content.removeFaq);
  const [editing, setEditing] = useState<{ id?: Id<"faqs">; question: string; answer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Published questions show on the public FAQ page, in this order.</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setPreview((p) => !p)}>{preview ? "Back to list" : "Preview FAQ page"}</Button>
          {can("content:create") ? <Button type="button" variant="gold" onClick={() => setEditing({ question: "", answer: "" })}>New question</Button> : null}
        </div>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {preview ? (
        <div className="rounded-[20px] bg-cream p-5 ring-1 ring-line">
          <p className="mb-3 text-xs font-semibold text-ink-2">Preview: published questions only</p>
          <FaqItems items={data.faqs.filter((f) => f.published)} />
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {data.faqs.map((f, i) => (
            <li key={f._id} className="flex flex-wrap items-center gap-3 rounded-[20px] bg-surface p-4 shadow-card">
              <div className="min-w-[200px] flex-1">
                <p className="font-semibold">{f.question}</p>
                <p className="line-clamp-2 text-sm text-ink-2">{f.answer}</p>
              </div>
              {can("content:edit") ? (
                <>
                  <div className="w-36">
                    <Switch checked={f.published} label={f.published ? "Published" : "Draft"} onChange={(published) => setPublished({ faqId: f._id, published }).catch((e) => setError(errorMessage(e)))} />
                  </div>
                  <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setEditing({ id: f._id, question: f.question, answer: f.answer })}>Edit</Button>
                  <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move up" disabled={i === 0} onClick={() => move({ table: "faqs", id: f._id, direction: "up" })}>▲</Button>
                  <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm" aria-label="Move down" disabled={i === data.faqs.length - 1} onClick={() => move({ table: "faqs", id: f._id, direction: "down" })}>▼</Button>
                </>
              ) : null}
              {can("content:delete") ? (
                <Button type="button" variant="ghost" className="min-h-10 px-3 text-sm text-danger" onClick={() => window.confirm("Delete this question?") && remove({ faqId: f._id })}>Delete</Button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit question" : "New question"}>
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await save({ faqId: editing.id, question: editing.question, answer: editing.answer });
                setEditing(null);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            {error ? <FormAlert>{error}</FormAlert> : null}
            <TextField id="faq-q" label="Question" maxLength={200} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            <TextArea id="faq-a" label="Answer" maxLength={3000} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            <p className="text-xs font-semibold text-ink-2">Preview</p>
            <FaqItems items={[{ _id: "preview", question: editing.question || "Question", answer: editing.answer || "Answer" }]} />
            <Button type="submit" variant="gold">Save question</Button>
          </form>
        ) : null}
      </Drawer>
    </section>
  );
}

// ---------------------------------------------------------------------------

const TEMPLATES: Record<"terms" | "privacy", string> = {
  terms: `# Terms of Service

DRAFT TEMPLATE: replace the bracketed parts and have a lawyer review this before publishing.

## Who we are
Event Planner is operated by [Company legal name], [address], Ontario, Canada. These terms apply when you use the Event Planner website and app.

## What Event Planner does
We help clients find event vendors (planners, photographers, caterers and others) in the Greater Toronto Area. We are not a party to agreements between clients and vendors.

## Payments
The app does not process payments. Prices, deposits and refunds are agreed directly between the client and the vendor.

## Your account
- Keep your password private and your details accurate.
- You must be 18 or older to create an account.
- We may suspend accounts that break these terms.

## Vendors
Vendors are responsible for the accuracy of their profiles, prices and availability, and for holding any licences their services need.

## Acceptable use
Don't post anything unlawful, misleading, abusive or that infringes someone else's rights. Don't use the app to send spam.

## Liability
[Limitation of liability wording.]

## Changes
We may update these terms. When we do, we'll ask you to accept the new version the next time you use the app.

## Contact
[Support email]`,
  privacy: `# Privacy Policy

DRAFT TEMPLATE: replace the bracketed parts and have a lawyer review this before publishing. It should meet PIPEDA and Ontario requirements.

## What we collect
- Account details: name, email, password (stored securely, never in plain text).
- Event details you enter: dates, locations, guest counts, budgets and answers to event questions.
- Messages and photos you send to vendors through the app.
- For vendors: business details, location, documents and portfolio photos.

## How we use it
To run the marketplace: showing vendors near your event, passing your inquiry to the vendor you contact, sending notifications and emails, and keeping the platform safe.

## Who we share it with
- The vendors you contact see the details you send them.
- Service providers that run the app for us: [hosting, database, email providers].
- We don't sell your personal information.

## How long we keep it
[Retention periods.] You can ask us to delete your account at any time.

## Your choices
You can see and update your details in the app, and ask us for a copy or deletion of your data by emailing [privacy email].

## Changes
When we update this policy, we'll ask you to review the new version the next time you use the app.

## Contact
[Privacy contact name and email]`,
};

function Legal({ kind, doc, canEdit }: { kind: "terms" | "privacy"; doc: Data["terms"]; canEdit: boolean }) {
  const saveDraft = useMutation(api.content.saveLegalDraft);
  const publish = useMutation(api.content.publishLegal);
  const discard = useMutation(api.content.discardLegalDraft);
  const [body, setBody] = useState(doc.draft?.body ?? doc.published?.body ?? "");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const label = kind === "terms" ? "Terms of Service" : "Privacy Policy";
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[20px] bg-surface p-4 text-sm shadow-card">
        <p>
          <span className="font-semibold">Published: </span>
          {doc.published ? `version ${doc.published.version}${doc.published.publishedAt ? `, ${formatDateTime(doc.published.publishedAt)}` : ""}` : "not yet"}
          {" · "}
          <a href={`/${kind}`} target="_blank" rel="noreferrer" className="font-semibold text-gold-text">Open public page</a>
        </p>
        <p className="mt-1">
          <span className="font-semibold">Draft: </span>
          {doc.draft ? `version ${doc.draft.version}, saved ${formatDateTime(doc.draft.updatedAt)}` : "none"}
        </p>
        <p className="mt-1 text-ink-2">Publishing a new version asks every logged-in person to accept it the next time they use the app.</p>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice ? <p role="status" className="rounded-2xl bg-success-bg px-4 py-3 text-sm font-medium text-success">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={view === "edit" ? "navy" : "secondary"} onClick={() => setView("edit")}>Edit</Button>
        <Button type="button" variant={view === "preview" ? "navy" : "secondary"} onClick={() => setView("preview")}>Preview</Button>
        {canEdit && !body.trim() ? <Button type="button" variant="ghost" onClick={() => setBody(TEMPLATES[kind])}>Start from a template</Button> : null}
      </div>
      {view === "edit" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${kind}-body`} className="text-xs font-semibold text-ink-2">{label}</label>
          <textarea
            id={`${kind}-body`}
            rows={22}
            readOnly={!canEdit}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-2xl border border-control bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed"
          />
          <p className="text-[13px] text-ink-2">Start a line with ## for a heading and - for a bullet. Leave a blank line between paragraphs.</p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-surface p-6 shadow-card">
          <p className="mb-4 text-xs font-semibold text-ink-2">Preview</p>
          <LegalText body={body || "Nothing written yet."} />
        </div>
      )}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => run(() => saveDraft({ kind, body }), "Draft saved.")}>Save draft</Button>
          <Button
            type="button"
            variant="gold"
            disabled={!doc.draft}
            onClick={() => {
              if (window.confirm(`Publish this ${label}? Everyone will be asked to accept it.`)) {
                void run(async () => {
                  const v = await publish({ kind });
                  return v;
                }, "Published. People will be asked to accept it on their next visit.");
              }
            }}
          >
            Publish draft
          </Button>
          {doc.draft ? (
            <Button type="button" variant="ghost" className="text-danger" onClick={() => run(() => discard({ kind }), "Draft discarded.").then(() => setBody(doc.published?.body ?? ""))}>
              Discard draft
            </Button>
          ) : null}
        </div>
      ) : null}
      {canEdit && doc.draft && body.trim() !== doc.draft.body ? <p className="text-sm text-ink-2">You have unsaved changes. Save the draft before publishing.</p> : null}
      {doc.history.length > 1 ? (
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer font-semibold">Version history</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {doc.history.map((h) => (
              <li key={h.version}>Version {h.version}{h.publishedAt ? ` · ${formatDateTime(h.publishedAt)}` : ""}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
