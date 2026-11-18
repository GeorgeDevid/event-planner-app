import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import type { Permission } from "./lib/permissions";
import { vendorStatus } from "./lib/validators";
import { notify } from "./lib/threads";
import { syncVendorLocation } from "./vendorSearch";

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

function requireReason(reason: string | undefined, what: string) {
  const text = reason?.trim() ?? "";
  if (text.length < 5) invalid(`Give a reason for ${what} (at least 5 characters).`);
  if (text.length > 1000) invalid("Keep the reason to 1,000 characters.");
  return text;
}

/** A-04 queue: vendors by status, oldest submission first for the pending tab. */
export const list = query({
  args: { status: v.optional(vendorStatus), search: v.optional(v.string()) },
  handler: async (ctx, { status, search }) => {
    await requirePermission(ctx, "vendors:view");
    const vendors = status
      ? await ctx.db
          .query("vendors")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("vendors").collect();

    const categories = new Map(
      (await ctx.db.query("categories").collect()).map((c) => [c._id, c.name]),
    );
    const term = search?.trim().toLowerCase();

    const rows = await Promise.all(
      vendors.map(async (vendor) => {
        const owner = await ctx.db.get(vendor.ownerId);
        const documents = await ctx.db
          .query("vendorDocuments")
          .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
          .collect();
        return {
          _id: vendor._id,
          companyName: vendor.companyName,
          ownerName: vendor.ownerName,
          ownerEmail: owner?.email ?? null,
          categories: vendor.categoryIds.map((id) => categories.get(id) ?? "—"),
          status: vendor.status,
          verified: vendor.verified,
          featured: vendor.featured,
          submittedAt: vendor.submittedAt ?? null,
          createdAt: vendor.createdAt,
          documentCount: documents.length,
          address: vendor.address ?? null,
        };
      }),
    );

    return rows
      .filter(
        (r) =>
          !term ||
          r.companyName.toLowerCase().includes(term) ||
          r.ownerName.toLowerCase().includes(term) ||
          (r.ownerEmail ?? "").includes(term),
      )
      .sort((a, b) =>
        status === "pending"
          ? (a.submittedAt ?? 0) - (b.submittedAt ?? 0)
          : b.createdAt - a.createdAt,
      );
  },
});

/** Counts per status for the tabs. */
export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "vendors:view");
    const vendors = await ctx.db.query("vendors").collect();
    const counts: Record<string, number> = { all: vendors.length };
    for (const v of vendors) counts[v.status] = (counts[v.status] ?? 0) + 1;
    counts.verified = vendors.filter((v) => v.verified).length;
    counts.featured = vendors.filter((v) => v.featured).length;
    return counts;
  },
});

/** Everything an admin needs to review one vendor (A-04 drawer). */
export const detail = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, { vendorId }) => {
    await requirePermission(ctx, "vendors:view");
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return null;
    const [owner, documents, images, packages, categories] = await Promise.all([
      ctx.db.get(vendor.ownerId),
      ctx.db
        .query("vendorDocuments")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendorId))
        .collect(),
      ctx.db
        .query("vendorImages")
        .withIndex("by_vendor_order", (q) => q.eq("vendorId", vendorId))
        .collect(),
      ctx.db
        .query("packages")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendorId))
        .collect(),
      Promise.all(vendor.categoryIds.map((id) => ctx.db.get(id))),
    ]);
    const history = (
      await ctx.db
        .query("auditLog")
        .withIndex("by_module", (q) => q.eq("module", "vendors"))
        .order("desc")
        .take(500)
    )
      .filter((row) => row.targetId === vendorId)
      .slice(0, 20);

    return {
      ...vendor,
      ownerEmail: owner?.email ?? null,
      ownerStatus: owner?.status ?? null,
      categories: categories.filter((c) => c !== null).map((c) => c.name),
      coverUrl: vendor.coverImageId ? await ctx.storage.getUrl(vendor.coverImageId) : null,
      logoUrl: vendor.logoId ? await ctx.storage.getUrl(vendor.logoId) : null,
      documents: await Promise.all(
        documents.map(async (d) => ({
          _id: d._id,
          name: d.name,
          contentType: d.contentType,
          size: d.size,
          url: await ctx.storage.getUrl(d.storageId),
        })),
      ),
      images: await Promise.all(
        images.map(async (i) => ({ _id: i._id, url: await ctx.storage.getUrl(i.storageId) })),
      ),
      packages,
      history: history.map((h) => ({ action: h.action, at: h.at, after: h.after ?? null })),
    };
  },
});

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

type Transition = {
  permission: Permission;
  from: Doc<"vendors">["status"][];
  to: Doc<"vendors">["status"];
  action: string;
  needsReason: string | null;
};

const TRANSITIONS = {
  approve: {
    permission: "vendors:approve",
    from: ["pending", "rejected"],
    to: "approved",
    action: "vendor.approved",
    needsReason: null,
  },
  reject: {
    permission: "vendors:approve",
    from: ["pending"],
    to: "rejected",
    action: "vendor.rejected",
    needsReason: "rejecting this vendor",
  },
  suspend: {
    permission: "vendors:suspend",
    from: ["approved", "pending"],
    to: "suspended",
    action: "vendor.suspended",
    needsReason: "suspending this vendor",
  },
  reactivate: {
    permission: "vendors:suspend",
    from: ["suspended"],
    to: "approved",
    action: "vendor.reactivated",
    needsReason: null,
  },
  deactivate: {
    permission: "vendors:delete",
    from: ["draft", "pending", "approved", "rejected", "suspended"],
    to: "deactivated",
    action: "vendor.deactivated",
    needsReason: "deactivating this vendor",
  },
} satisfies Record<string, Transition>;

export const changeStatus = mutation({
  args: {
    vendorId: v.id("vendors"),
    change: v.union(
      v.literal("approve"),
      v.literal("reject"),
      v.literal("suspend"),
      v.literal("reactivate"),
      v.literal("deactivate"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { vendorId, change, reason }) => {
    const t: Transition = TRANSITIONS[change];
    const admin = await requirePermission(ctx, t.permission);
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) invalid("Vendor not found.");
    if (!t.from.includes(vendor.status)) {
      invalid(`A ${vendor.status} vendor can't be changed this way.`);
    }
    const text = t.needsReason ? requireReason(reason, t.needsReason) : undefined;
    if (change === "approve" && (!vendor.location || vendor.categoryIds.length === 0)) {
      invalid("This vendor has no location or services yet, so it can't appear in search.");
    }

    await ctx.db.patch(vendorId, {
      status: t.to,
      rejectionReason: change === "reject" ? text : change === "approve" ? undefined : vendor.rejectionReason,
    });
    await syncVendorLocation(ctx, vendorId);
    const message = {
      approve: { title: "Your business is approved", body: "Clients can now find you in search." },
      reject: { title: "Changes needed before approval", body: text },
      suspend: { title: "Your business has been suspended", body: text },
      reactivate: { title: "Your business is active again", body: "Clients can find you in search again." },
      deactivate: { title: "Your business has been deactivated", body: text },
    }[change];
    await notify(ctx, vendor.ownerId, { ...message, href: "/vendor" });
    await audit(ctx, {
      actor: admin,
      action: t.action,
      module: "vendors",
      targetTable: "vendors",
      targetId: vendorId,
      before: { status: vendor.status },
      after: { status: t.to, ...(text ? { reason: text } : {}) },
    });
  },
});

async function toggle(
  ctx: MutationCtx,
  vendorId: Id<"vendors">,
  field: "verified" | "featured",
  value: boolean,
) {
  const admin = await requirePermission(ctx, "vendors:edit");
  const vendor = await ctx.db.get(vendorId);
  if (!vendor) invalid("Vendor not found.");
  if (value && vendor.status !== "approved") {
    invalid(`Only approved vendors can be ${field === "verified" ? "verified" : "featured"}.`);
  }
  await ctx.db.patch(vendorId, { [field]: value });
  await audit(ctx, {
    actor: admin,
    action: `vendor.${field === "verified" ? (value ? "verified" : "unverified") : value ? "featured" : "unfeatured"}`,
    module: "vendors",
    targetTable: "vendors",
    targetId: vendorId,
    before: { [field]: vendor[field] },
    after: { [field]: value },
  });
}

export const setVerified = mutation({
  args: { vendorId: v.id("vendors"), value: v.boolean() },
  handler: (ctx, { vendorId, value }) => toggle(ctx, vendorId, "verified", value),
});

export const setFeatured = mutation({
  args: { vendorId: v.id("vendors"), value: v.boolean() },
  handler: (ctx, { vendorId, value }) => toggle(ctx, vendorId, "featured", value),
});

/** Unpublish a portfolio photo that breaks the rules (V-03 #4, A-04 #4). */
export const removeImage = mutation({
  args: { imageId: v.id("vendorImages"), reason: v.string() },
  handler: async (ctx, { imageId, reason }) => {
    const admin = await requirePermission(ctx, "vendors:edit");
    const text = requireReason(reason, "removing this photo");
    const image = await ctx.db.get(imageId);
    if (!image) invalid("Photo not found.");
    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(imageId);
    await audit(ctx, {
      actor: admin,
      action: "vendor.photo_removed",
      module: "vendors",
      targetTable: "vendors",
      targetId: image.vendorId,
      after: { reason: text },
    });
  },
});
