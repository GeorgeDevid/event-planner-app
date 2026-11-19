import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { audit, requirePermission, requireUser } from "./lib/access";
import { isIsoDate, torontoToday } from "./lib/dates";
import { checkUpload, IMAGE_TYPES, MAX_IMAGE_BYTES } from "./lib/vendorAccess";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

const isSafeLink = (url: string) => url.startsWith("/") || /^https:\/\/[^\s]+$/.test(url);
type Kind = "terms" | "privacy";
const KIND_LABEL: Record<Kind, string> = { terms: "Terms of Service", privacy: "Privacy Policy" };

async function latest(ctx: QueryCtx, kind: Kind, status?: "published") {
  const rows = await ctx.db
    .query("legalDocs")
    .withIndex("by_kind_version", (q) => q.eq("kind", kind))
    .order("desc")
    .collect();
  return (status ? rows.find((r) => r.status === status) : rows[0]) ?? null;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** Banners live today, for the client home (A-09 #1). */
export const activeBanners = query({
  args: {},
  handler: async (ctx) => {
    const today = torontoToday();
    const rows = await ctx.db.query("banners").withIndex("by_order").collect();
    return Promise.all(
      rows
        .filter((b) => b.published && (!b.startsOn || b.startsOn <= today) && (!b.endsOn || b.endsOn >= today))
        .map(async (b) => ({
          _id: b._id,
          title: b.title,
          body: b.body ?? null,
          linkUrl: b.linkUrl ?? null,
          linkLabel: b.linkLabel ?? null,
          imageUrl: b.imageId ? await ctx.storage.getUrl(b.imageId) : null,
        })),
    );
  },
});

export const publishedFaqs = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("faqs").withIndex("by_order").collect())
      .filter((f) => f.published)
      .map((f) => ({ _id: f._id, question: f.question, answer: f.answer })),
});

/** App reviews for the landing page (published only, in admin order). */
export const publishedTestimonials = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("testimonials").withIndex("by_order").collect();
    return rows
      .filter((t) => t.published)
      .map((t) => ({ _id: t._id, name: t.name, detail: t.detail ?? null, quote: t.quote, rating: t.rating }));
  },
});

export const legal = query({
  args: { kind: v.union(v.literal("terms"), v.literal("privacy")) },
  handler: async (ctx, { kind }) => {
    const doc = await latest(ctx, kind, "published");
    return doc ? { version: doc.version, body: doc.body, publishedAt: doc.publishedAt ?? doc.updatedAt } : null;
  },
});

/** Policies the signed-in person still has to accept (A-09 #3). */
export const pendingAcceptance = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const out: { kind: Kind; label: string; version: number }[] = [];
    for (const kind of ["terms", "privacy"] as const) {
      const doc = await latest(ctx, kind, "published");
      const accepted = kind === "terms" ? user.acceptedTermsVersion : user.acceptedPrivacyVersion;
      if (doc && (accepted ?? 0) < doc.version) out.push({ kind, label: KIND_LABEL[kind], version: doc.version });
    }
    return out;
  },
});

export const acceptPolicies = mutation({
  args: { terms: v.optional(v.number()), privacy: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patch: Partial<Doc<"users">> = {};
    for (const kind of ["terms", "privacy"] as const) {
      const version = args[kind];
      if (version === undefined) continue;
      const doc = await latest(ctx, kind, "published");
      if (!doc || doc.version !== version) invalid(`The ${KIND_LABEL[kind]} changed again. Reload and review it.`);
      if (kind === "terms") patch.acceptedTermsVersion = version;
      else patch.acceptedPrivacyVersion = version;
    }
    await ctx.db.patch(user._id, patch);
    await audit(ctx, { actor: user, action: "user.accepted_policies", module: "content", targetTable: "users", targetId: user._id, after: patch });
  },
});

// ---------------------------------------------------------------------------
// Admin: everything, including drafts (A-09)
// ---------------------------------------------------------------------------

export const adminAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "content:view");
    const banners = await ctx.db.query("banners").withIndex("by_order").collect();
    const faqs = await ctx.db.query("faqs").withIndex("by_order").collect();
    const testimonials = await ctx.db.query("testimonials").withIndex("by_order").collect();
    const docs = await ctx.db.query("legalDocs").collect();
    const legalFor = (kind: Kind) => {
      const rows = docs.filter((d) => d.kind === kind).sort((a, b) => b.version - a.version);
      const published = rows.find((r) => r.status === "published") ?? null;
      const draft = rows.find((r) => r.status === "draft") ?? null;
      return {
        published: published ? { version: published.version, body: published.body, publishedAt: published.publishedAt ?? null } : null,
        draft: draft ? { _id: draft._id, version: draft.version, body: draft.body, updatedAt: draft.updatedAt } : null,
        history: rows.filter((r) => r.status === "published").map((r) => ({ version: r.version, publishedAt: r.publishedAt ?? null })),
      };
    };
    return {
      banners: await Promise.all(
        banners.map(async (b) => ({ ...b, imageUrl: b.imageId ? await ctx.storage.getUrl(b.imageId) : null })),
      ),
      faqs,
      testimonials,
      terms: legalFor("terms"),
      privacy: legalFor("privacy"),
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "content:edit");
    return await ctx.storage.generateUploadUrl();
  },
});

const bannerFields = {
  title: v.string(),
  body: v.optional(v.string()),
  imageId: v.optional(v.id("_storage")),
  linkUrl: v.optional(v.string()),
  linkLabel: v.optional(v.string()),
  startsOn: v.optional(v.string()),
  endsOn: v.optional(v.string()),
};

export const saveBanner = mutation({
  args: { bannerId: v.optional(v.id("banners")), ...bannerFields },
  handler: async (ctx, { bannerId, ...f }) => {
    const admin = await requirePermission(ctx, bannerId ? "content:edit" : "content:create");
    const title = f.title.trim();
    if (title.length < 2 || title.length > 80) invalid("Use a title between 2 and 80 characters.", "title");
    const body = f.body?.trim() || undefined;
    if (body && body.length > 240) invalid("Keep the text to 240 characters.", "body");
    const linkUrl = f.linkUrl?.trim() || undefined;
    if (linkUrl && !isSafeLink(linkUrl)) invalid("Links must start with / (a page in the app) or https://.", "linkUrl");
    const linkLabel = f.linkLabel?.trim() || undefined;
    if (linkUrl && !linkLabel) invalid("Add button text for the link.", "linkLabel");
    for (const [d, field] of [[f.startsOn, "startsOn"], [f.endsOn, "endsOn"]] as const) {
      if (d && !isIsoDate(d)) invalid("Enter a valid date.", field);
    }
    if (f.startsOn && f.endsOn && f.startsOn > f.endsOn) invalid("The end date is before the start date.", "endsOn");
    if (f.imageId) await checkUpload(ctx, f.imageId, { types: IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES, label: "JPG, PNG or WebP" });
    const data = { title, body, imageId: f.imageId, linkUrl, linkLabel: linkUrl ? linkLabel : undefined, startsOn: f.startsOn || undefined, endsOn: f.endsOn || undefined, updatedAt: Date.now() };
    if (bannerId) {
      const old = await ctx.db.get(bannerId);
      if (!old) invalid("Banner not found.");
      if (old.imageId && old.imageId !== f.imageId) await ctx.storage.delete(old.imageId).catch(() => {});
      await ctx.db.patch(bannerId, data);
      await audit(ctx, { actor: admin, action: "content.banner_updated", module: "content", targetTable: "banners", targetId: bannerId });
      return bannerId;
    }
    const count = (await ctx.db.query("banners").collect()).length;
    const id = await ctx.db.insert("banners", { ...data, published: false, order: count });
    await audit(ctx, { actor: admin, action: "content.banner_created", module: "content", targetTable: "banners", targetId: id });
    return id;
  },
});

export const setBannerPublished = mutation({
  args: { bannerId: v.id("banners"), published: v.boolean() },
  handler: async (ctx, { bannerId, published }) => {
    const admin = await requirePermission(ctx, "content:edit");
    await ctx.db.patch(bannerId, { published, updatedAt: Date.now() });
    await audit(ctx, { actor: admin, action: published ? "content.banner_published" : "content.banner_unpublished", module: "content", targetTable: "banners", targetId: bannerId });
  },
});

export const removeBanner = mutation({
  args: { bannerId: v.id("banners") },
  handler: async (ctx, { bannerId }) => {
    const admin = await requirePermission(ctx, "content:delete");
    const b = await ctx.db.get(bannerId);
    if (!b) return;
    if (b.imageId) await ctx.storage.delete(b.imageId).catch(() => {});
    await ctx.db.delete(bannerId);
    await audit(ctx, { actor: admin, action: "content.banner_deleted", module: "content", targetTable: "banners", targetId: bannerId, before: { title: b.title } });
  },
});

export const saveFaq = mutation({
  args: { faqId: v.optional(v.id("faqs")), question: v.string(), answer: v.string() },
  handler: async (ctx, { faqId, question, answer }) => {
    const admin = await requirePermission(ctx, faqId ? "content:edit" : "content:create");
    const q = question.trim();
    const a = answer.trim();
    if (q.length < 5 || q.length > 200) invalid("Write a question (5 to 200 characters).", "question");
    if (a.length < 5 || a.length > 3000) invalid("Write an answer (5 to 3,000 characters).", "answer");
    if (faqId) {
      await ctx.db.patch(faqId, { question: q, answer: a, updatedAt: Date.now() });
      await audit(ctx, { actor: admin, action: "content.faq_updated", module: "content", targetTable: "faqs", targetId: faqId });
      return faqId;
    }
    const count = (await ctx.db.query("faqs").collect()).length;
    const id = await ctx.db.insert("faqs", { question: q, answer: a, published: false, order: count, updatedAt: Date.now() });
    await audit(ctx, { actor: admin, action: "content.faq_created", module: "content", targetTable: "faqs", targetId: id });
    return id;
  },
});

export const setFaqPublished = mutation({
  args: { faqId: v.id("faqs"), published: v.boolean() },
  handler: async (ctx, { faqId, published }) => {
    const admin = await requirePermission(ctx, "content:edit");
    await ctx.db.patch(faqId, { published, updatedAt: Date.now() });
    await audit(ctx, { actor: admin, action: published ? "content.faq_published" : "content.faq_unpublished", module: "content", targetTable: "faqs", targetId: faqId });
  },
});

export const moveItem = mutation({
  args: { table: v.union(v.literal("banners"), v.literal("faqs"), v.literal("testimonials")), id: v.string(), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { table, id, direction }) => {
    await requirePermission(ctx, "content:edit");
    const rows = await ctx.db.query(table).withIndex("by_order").collect();
    const i = rows.findIndex((r) => r._id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i === -1 || !rows[j]) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [n, row] of rows.entries()) if (row.order !== n) await ctx.db.patch(row._id, { order: n });
  },
});

export const removeFaq = mutation({
  args: { faqId: v.id("faqs") },
  handler: async (ctx, { faqId }) => {
    const admin = await requirePermission(ctx, "content:delete");
    await ctx.db.delete(faqId);
    await audit(ctx, { actor: admin, action: "content.faq_deleted", module: "content", targetTable: "faqs", targetId: faqId });
  },
});

export const saveTestimonial = mutation({
  args: {
    testimonialId: v.optional(v.id("testimonials")),
    name: v.string(),
    detail: v.optional(v.string()),
    quote: v.string(),
    rating: v.number(),
  },
  handler: async (ctx, { testimonialId, name, detail, quote, rating }) => {
    const admin = await requirePermission(ctx, testimonialId ? "content:edit" : "content:create");
    const n = name.trim();
    const d = detail?.trim() || undefined;
    const q = quote.trim();
    if (n.length < 2 || n.length > 80) invalid("Enter the reviewer's name (2 to 80 characters).", "name");
    if (d && d.length > 80) invalid("Keep the detail under 80 characters.", "detail");
    if (q.length < 10 || q.length > 600) invalid("Write the review (10 to 600 characters).", "quote");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) invalid("Pick a rating from 1 to 5 stars.", "rating");
    const fields = { name: n, detail: d, quote: q, rating, updatedAt: Date.now() };
    if (testimonialId) {
      await ctx.db.patch(testimonialId, fields);
      await audit(ctx, { actor: admin, action: "content.testimonial_updated", module: "content", targetTable: "testimonials", targetId: testimonialId });
      return testimonialId;
    }
    const count = (await ctx.db.query("testimonials").collect()).length;
    const id = await ctx.db.insert("testimonials", { ...fields, published: false, order: count });
    await audit(ctx, { actor: admin, action: "content.testimonial_created", module: "content", targetTable: "testimonials", targetId: id });
    return id;
  },
});

export const setTestimonialPublished = mutation({
  args: { testimonialId: v.id("testimonials"), published: v.boolean() },
  handler: async (ctx, { testimonialId, published }) => {
    const admin = await requirePermission(ctx, "content:edit");
    await ctx.db.patch(testimonialId, { published, updatedAt: Date.now() });
    await audit(ctx, { actor: admin, action: published ? "content.testimonial_published" : "content.testimonial_unpublished", module: "content", targetTable: "testimonials", targetId: testimonialId });
  },
});

export const removeTestimonial = mutation({
  args: { testimonialId: v.id("testimonials") },
  handler: async (ctx, { testimonialId }) => {
    const admin = await requirePermission(ctx, "content:delete");
    const t = await ctx.db.get(testimonialId);
    if (!t) return;
    await ctx.db.delete(testimonialId);
    await audit(ctx, { actor: admin, action: "content.testimonial_deleted", module: "content", targetTable: "testimonials", targetId: testimonialId, before: { name: t.name } });
  },
});

/** Save the working draft of the Terms or Privacy Policy. */
export const saveLegalDraft = mutation({
  args: { kind: v.union(v.literal("terms"), v.literal("privacy")), body: v.string() },
  handler: async (ctx, { kind, body }) => {
    const admin = await requirePermission(ctx, "content:edit");
    const text = body.trim();
    if (text.length < 50) invalid("The document looks too short.", "body");
    if (text.length > 60_000) invalid("The document is too long.", "body");
    const top = await latest(ctx, kind);
    if (top && top.status === "draft") {
      await ctx.db.patch(top._id, { body: text, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("legalDocs", { kind, version: (top?.version ?? 0) + 1, body: text, status: "draft", updatedAt: Date.now() });
    }
    await audit(ctx, { actor: admin, action: `content.${kind}_draft_saved`, module: "content", targetTable: "legalDocs", targetId: kind });
  },
});

/** Publish the draft as the new version; everyone is asked to accept it. */
export const publishLegal = mutation({
  args: { kind: v.union(v.literal("terms"), v.literal("privacy")) },
  handler: async (ctx, { kind }) => {
    const admin = await requirePermission(ctx, "content:edit");
    const top = await latest(ctx, kind);
    if (!top || top.status !== "draft") invalid("There's no draft to publish.");
    await ctx.db.patch(top._id, { status: "published", publishedAt: Date.now(), updatedAt: Date.now() });
    // The admin publishing it has read it.
    await ctx.db.patch(admin._id, kind === "terms" ? { acceptedTermsVersion: top.version } : { acceptedPrivacyVersion: top.version });
    await audit(ctx, { actor: admin, action: `content.${kind}_published`, module: "content", targetTable: "legalDocs", targetId: kind, after: { version: top.version } });
    return top.version;
  },
});

export const discardLegalDraft = mutation({
  args: { kind: v.union(v.literal("terms"), v.literal("privacy")) },
  handler: async (ctx, { kind }) => {
    await requirePermission(ctx, "content:edit");
    const top = await latest(ctx, kind);
    if (top && top.status === "draft") await ctx.db.delete(top._id);
  },
});
