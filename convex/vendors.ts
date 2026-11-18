import { torontoToday } from "./lib/dates";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { audit, getCurrentUser, userCan } from "./lib/access";
import { notify } from "./lib/threads";
import {
  checkUpload,
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_PORTFOLIO,
  recomputeAvgPrice,
  requireEditableVendor,
  requireMyVendor,
} from "./lib/vendorAccess";
import { priceType, priceUnit } from "./lib/validators";
import { syncVendorLocation } from "./vendorSearch";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

async function imagesFor(ctx: QueryCtx, vendorId: Id<"vendors">) {
  const rows = await ctx.db
    .query("vendorImages")
    .withIndex("by_vendor_order", (q) => q.eq("vendorId", vendorId))
    .collect();
  return Promise.all(
    rows.map(async (row) => ({
      _id: row._id,
      url: await ctx.storage.getUrl(row.storageId),
    })),
  );
}

/** What's still needed before the business can be sent for review (V-01, V-08). */
function setupChecklist(vendor: Doc<"vendors">, packageCount: number) {
  return {
    details: vendor.companyName.trim().length >= 2 && vendor.ownerName.trim().length >= 2,
    categories: vendor.categoryIds.length > 0,
    location: vendor.location !== undefined,
    packages: packageCount > 0,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Everything the vendor's own screens need (V-01 to V-05, V-08). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { vendor } = await requireMyVendor(ctx);
    const [packages, documents, images, categories] = await Promise.all([
      ctx.db
        .query("packages")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
        .collect(),
      ctx.db
        .query("vendorDocuments")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
        .collect(),
      imagesFor(ctx, vendor._id),
      Promise.all(vendor.categoryIds.map((id) => ctx.db.get(id))),
    ]);
    const checklist = setupChecklist(vendor, packages.filter((p) => p.active).length);
    return {
      ...vendor,
      coverUrl: vendor.coverImageId ? await ctx.storage.getUrl(vendor.coverImageId) : null,
      logoUrl: vendor.logoId ? await ctx.storage.getUrl(vendor.logoId) : null,
      categories: categories.filter((c) => c !== null).map((c) => ({ _id: c._id, name: c.name })),
      packages: packages.sort((a, b) => a._creationTime - b._creationTime),
      documents: documents.map((d) => ({
        _id: d._id,
        name: d.name,
        contentType: d.contentType,
        size: d.size,
      })),
      images,
      maxPortfolio: MAX_PORTFOLIO,
      checklist,
      canSubmit:
        (vendor.status === "draft" || vendor.status === "rejected") &&
        checklist.details &&
        checklist.categories &&
        checklist.location,
    };
  },
});

/**
 * A vendor's public profile (C-10, V-03 "preview as client"). Approved
 * businesses are visible to anyone; the owner can preview theirs in any state.
 */
export const publicProfile = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, { vendorId }) => {
    const vendor = await ctx.db.get(vendorId);
    if (!vendor) return null;
    const user = await getCurrentUser(ctx);
    const isOwner = user?._id === vendor.ownerId;
    if (vendor.status !== "approved" && !isOwner) return null;

    const [packages, images, categories] = await Promise.all([
      ctx.db
        .query("packages")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendorId))
        .collect(),
      imagesFor(ctx, vendorId),
      Promise.all(vendor.categoryIds.map((id) => ctx.db.get(id))),
    ]);
    return {
      _id: vendor._id,
      companyName: vendor.companyName,
      ownerName: vendor.ownerName,
      about: vendor.about ?? null,
      serviceArea: vendor.clientsComeToMe
        ? (vendor.address ?? null)
        : `Within ${vendor.serviceRadiusKm} km of ${vendor.address ?? "their base"}`,
      clientsComeToMe: vendor.clientsComeToMe,
      verified: vendor.verified,
      featured: vendor.featured,
      avgPriceCents: vendor.avgPriceCents ?? null,
      categories: categories.filter((c) => c !== null).map((c) => c.name),
      categoryOptions: categories
        .filter((c) => c !== null && c.active)
        .map((c) => ({ _id: c!._id, name: c!.name })),
      coverUrl: vendor.coverImageId ? await ctx.storage.getUrl(vendor.coverImageId) : null,
      logoUrl: vendor.logoId ? await ctx.storage.getUrl(vendor.logoId) : null,
      images: images.map((i) => i.url),
      packages: packages
        .filter((p) => p.active)
        .map((p) => ({
          _id: p._id,
          name: p.name,
          description: p.description ?? null,
          priceCents: p.priceCents,
          priceType: p.priceType,
          unit: p.unit,
        })),
      isPreview: vendor.status !== "approved",
    };
  },
});

// ---------------------------------------------------------------------------
// V-01 business details, categories, documents, submit for approval
// ---------------------------------------------------------------------------

export const updateDetails = mutation({
  args: {
    companyName: v.string(),
    ownerName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { vendor } = await requireEditableVendor(ctx);
    const companyName = args.companyName.trim();
    const ownerName = args.ownerName.trim();
    if (companyName.length < 2) invalid("Enter your company name.");
    if (ownerName.length < 2) invalid("Enter the owner's name.");
    const phone = args.phone?.trim() || undefined;
    if (phone && !/^[+()\-\s\d]{7,20}$/.test(phone)) invalid("Enter a valid phone number.");
    await ctx.db.patch(vendor._id, { companyName, ownerName, phone });
  },
});

export const setCategories = mutation({
  args: { categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { categoryIds }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const unique = [...new Set(categoryIds)];
    if (unique.length === 0) invalid("Choose at least one category.");
    if (unique.length > 5) invalid("Choose up to 5 categories.");
    for (const id of unique) {
      const category = await ctx.db.get(id);
      if (!category || !category.active) invalid("One of those categories isn't available.");
    }
    await ctx.db.patch(vendor._id, { categoryIds: unique });
    await syncVendorLocation(ctx, vendor._id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireEditableVendor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addDocument = mutation({
  args: { storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, { storageId, name }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const meta = await checkUpload(ctx, storageId, {
      types: DOCUMENT_TYPES,
      maxBytes: MAX_DOCUMENT_BYTES,
      label: "PDF, JPG or PNG",
    });
    const existing = await ctx.db
      .query("vendorDocuments")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    if (existing.length >= 5) {
      await ctx.storage.delete(storageId);
      invalid("You can upload up to 5 documents.");
    }
    await ctx.db.insert("vendorDocuments", {
      vendorId: vendor._id,
      storageId,
      name: name.trim().slice(0, 120) || "Document",
      contentType: meta.contentType ?? "",
      size: meta.size,
      uploadedAt: Date.now(),
    });
  },
});

export const removeDocument = mutation({
  args: { documentId: v.id("vendorDocuments") },
  handler: async (ctx, { documentId }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.vendorId !== vendor._id) invalid("Document not found.");
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(documentId);
  },
});

/** Send the business for review: draft or rejected → pending (V-01). */
export const submitForApproval = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, vendor } = await requireEditableVendor(ctx);
    if (vendor.status === "pending") invalid("Your business is already being reviewed.");
    if (vendor.status === "approved") invalid("Your business is already approved.");
    const packages = await ctx.db
      .query("packages")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    const checklist = setupChecklist(vendor, packages.filter((p) => p.active).length);
    if (!checklist.details) invalid("Add your business details first.");
    if (!checklist.categories) invalid("Choose at least one category first.");
    if (!checklist.location) invalid("Set your business location first.");

    await ctx.db.patch(vendor._id, {
      status: "pending",
      submittedAt: Date.now(),
      rejectionReason: undefined,
    });
    await audit(ctx, {
      actor: user,
      action: "vendor.submitted",
      module: "vendors",
      targetTable: "vendors",
      targetId: vendor._id,
      before: { status: vendor.status },
      after: { status: "pending" },
    });
    // V-01 #2: tell the admins who can approve vendors.
    const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).collect();
    for (const a of admins) {
      if (a.status === "active" && !a.deletedAt && (await userCan(ctx, a, "vendors:approve"))) {
        await notify(ctx, a._id, {
          title: `${vendor.companyName} is waiting for approval`,
          body: vendor.status === "rejected" ? "They made changes and resubmitted." : "A new business was submitted for review.",
          href: "/admin/vendors",
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// V-02 location and service radius
// ---------------------------------------------------------------------------

export const setLocation = mutation({
  args: {
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    serviceRadiusKm: v.number(),
    clientsComeToMe: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { vendor } = await requireEditableVendor(ctx);
    const address = args.address.trim();
    if (address.length < 3) invalid("Enter your business address.");
    if (args.lat < -90 || args.lat > 90 || args.lng < -180 || args.lng > 180) {
      invalid("That location isn't valid.");
    }
    const radius = Math.round(args.serviceRadiusKm);
    if (radius < 5 || radius > 200) invalid("Service radius must be between 5 and 200 km.");
    await ctx.db.patch(vendor._id, {
      address,
      location: { lat: args.lat, lng: args.lng },
      serviceRadiusKm: radius,
      clientsComeToMe: args.clientsComeToMe,
    });
    await syncVendorLocation(ctx, vendor._id);
  },
});

// ---------------------------------------------------------------------------
// V-03 profile and portfolio
// ---------------------------------------------------------------------------

export const updateAbout = mutation({
  args: { about: v.string() },
  handler: async (ctx, { about }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const text = about.trim();
    if (text.length > 2000) invalid("Keep the about section to 2,000 characters.");
    await ctx.db.patch(vendor._id, { about: text || undefined });
  },
});

export const setBrandImage = mutation({
  args: { kind: v.union(v.literal("cover"), v.literal("logo")), storageId: v.id("_storage") },
  handler: async (ctx, { kind, storageId }) => {
    const { user, vendor } = await requireEditableVendor(ctx);
    await checkUpload(ctx, storageId, {
      types: IMAGE_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      label: "JPG, PNG or WebP",
    });
    const field = kind === "cover" ? "coverImageId" : "logoId";
    const previous = vendor[field];
    await ctx.db.patch(vendor._id, { [field]: storageId });
    if (previous) await ctx.storage.delete(previous);
    if (vendor.status === "approved") {
      await audit(ctx, {
        actor: user,
        action: `vendor.${kind}_changed`,
        module: "vendors",
        targetTable: "vendors",
        targetId: vendor._id,
      });
    }
  },
});

export const addPortfolioImages = mutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { storageIds }) => {
    const { user, vendor } = await requireEditableVendor(ctx);
    const existing = await ctx.db
      .query("vendorImages")
      .withIndex("by_vendor_order", (q) => q.eq("vendorId", vendor._id))
      .collect();
    if (existing.length + storageIds.length > MAX_PORTFOLIO) {
      for (const id of storageIds) await ctx.storage.delete(id);
      invalid(
        `You can have up to ${MAX_PORTFOLIO} photos. You have room for ${MAX_PORTFOLIO - existing.length} more.`,
      );
    }
    let order = existing.reduce((max, row) => Math.max(max, row.order), -1);
    for (const storageId of storageIds) {
      await checkUpload(ctx, storageId, {
        types: IMAGE_TYPES,
        maxBytes: MAX_IMAGE_BYTES,
        label: "JPG, PNG or WebP",
      });
      order += 1;
      await ctx.db.insert("vendorImages", { vendorId: vendor._id, storageId, order });
    }
    if (vendor.status === "approved") {
      await audit(ctx, {
        actor: user,
        action: "vendor.portfolio_added",
        module: "vendors",
        targetTable: "vendors",
        targetId: vendor._id,
        after: { added: storageIds.length },
      });
    }
  },
});

export const removePortfolioImage = mutation({
  args: { imageId: v.id("vendorImages") },
  handler: async (ctx, { imageId }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const image = await ctx.db.get(imageId);
    if (!image || image.vendorId !== vendor._id) invalid("Photo not found.");
    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(imageId);
  },
});

/** Move a photo one place earlier or later (buttons work without drag-and-drop). */
export const movePortfolioImage = mutation({
  args: { imageId: v.id("vendorImages"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { imageId, direction }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const rows = await ctx.db
      .query("vendorImages")
      .withIndex("by_vendor_order", (q) => q.eq("vendorId", vendor._id))
      .collect();
    const index = rows.findIndex((r) => r._id === imageId);
    if (index === -1) invalid("Photo not found.");
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= rows.length) return;
    const a = rows[index];
    const b = rows[swapWith];
    await ctx.db.patch(a._id, { order: b.order });
    await ctx.db.patch(b._id, { order: a.order });
  },
});

// ---------------------------------------------------------------------------
// V-04 packages and pricing
// ---------------------------------------------------------------------------

const packageFields = {
  name: v.string(),
  description: v.optional(v.string()),
  priceCents: v.number(),
  priceType,
  unit: priceUnit,
};

function cleanPackage(args: {
  name: string;
  description?: string;
  priceCents: number;
}) {
  const name = args.name.trim();
  if (name.length < 2) invalid("Give the package a name.");
  if (name.length > 80) invalid("Keep the package name to 80 characters.");
  const description = args.description?.trim() || undefined;
  if (description && description.length > 1000) {
    invalid("Keep the description to 1,000 characters.");
  }
  if (!Number.isInteger(args.priceCents) || args.priceCents <= 0) invalid("Enter a price above $0.");
  if (args.priceCents > 100_000_000) invalid("That price is too high.");
  return { name, description };
}

export const createPackage = mutation({
  args: packageFields,
  handler: async (ctx, args) => {
    const { vendor } = await requireEditableVendor(ctx);
    const { name, description } = cleanPackage(args);
    const count = (
      await ctx.db
        .query("packages")
        .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
        .collect()
    ).length;
    if (count >= 20) invalid("You can have up to 20 packages.");
    await ctx.db.insert("packages", {
      vendorId: vendor._id,
      name,
      description,
      priceCents: args.priceCents,
      priceType: args.priceType,
      unit: args.unit,
      active: true,
    });
    await recomputeAvgPrice(ctx, vendor._id);
    await syncVendorLocation(ctx, vendor._id);
  },
});

export const updatePackage = mutation({
  args: { packageId: v.id("packages"), ...packageFields },
  handler: async (ctx, { packageId, ...args }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const pkg = await ctx.db.get(packageId);
    if (!pkg || pkg.vendorId !== vendor._id) invalid("Package not found.");
    const { name, description } = cleanPackage(args);
    await ctx.db.patch(packageId, {
      name,
      description,
      priceCents: args.priceCents,
      priceType: args.priceType,
      unit: args.unit,
    });
    await recomputeAvgPrice(ctx, vendor._id);
    await syncVendorLocation(ctx, vendor._id);
  },
});

export const setPackageActive = mutation({
  args: { packageId: v.id("packages"), active: v.boolean() },
  handler: async (ctx, { packageId, active }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const pkg = await ctx.db.get(packageId);
    if (!pkg || pkg.vendorId !== vendor._id) invalid("Package not found.");
    await ctx.db.patch(packageId, { active });
    await recomputeAvgPrice(ctx, vendor._id);
    await syncVendorLocation(ctx, vendor._id);
  },
});

export const deletePackage = mutation({
  args: { packageId: v.id("packages") },
  handler: async (ctx, { packageId }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const pkg = await ctx.db.get(packageId);
    if (!pkg || pkg.vendorId !== vendor._id) invalid("Package not found.");
    await ctx.db.delete(packageId);
    await recomputeAvgPrice(ctx, vendor._id);
    await syncVendorLocation(ctx, vendor._id);
  },
});

// ---------------------------------------------------------------------------
// V-05 availability calendar
// ---------------------------------------------------------------------------

/** Blocked and booked days between two dates (inclusive), for the calendar. */
export const calendar = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const { vendor } = await requireMyVendor(ctx);
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) invalid("Invalid date range.");
    const blocked = await ctx.db
      .query("blockedDates")
      .withIndex("by_vendor_date", (q) =>
        q.eq("vendorId", vendor._id).gte("date", from).lte("date", to),
      )
      .collect();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    const booked = bookings
      .filter((b) => b.status === "accepted" && b.serviceDate >= from && b.serviceDate <= to)
      .map((b) => b.serviceDate);
    return {
      blocked: blocked.map((b) => b.date),
      booked: [...new Set(booked)],
      multipleBookingsPerDay: vendor.multipleBookingsPerDay ?? false,
    };
  },
});


export const setDatesBlocked = mutation({
  args: { dates: v.array(v.string()), blocked: v.boolean() },
  handler: async (ctx, { dates, blocked }) => {
    const { vendor } = await requireEditableVendor(ctx);
    const unique = [...new Set(dates)];
    if (unique.length === 0) return { changed: 0 };
    if (unique.length > 366) invalid("Choose up to a year of dates at a time.");
    const today = torontoToday();
    for (const date of unique) {
      if (!DATE_RE.test(date)) invalid("Invalid date.");
      if (date < today) invalid("Past dates can't be changed.");
    }

    if (blocked) {
      const accepted = (
        await ctx.db
          .query("bookings")
          .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
          .collect()
      ).filter((b) => b.status === "accepted" && unique.includes(b.serviceDate));
      if (accepted.length > 0) {
        invalid(
          `${accepted[0].serviceDate} has an accepted booking. Cancel that booking before blocking the day.`,
        );
      }
    }

    let changed = 0;
    for (const date of unique) {
      const existing = await ctx.db
        .query("blockedDates")
        .withIndex("by_vendor_date", (q) => q.eq("vendorId", vendor._id).eq("date", date))
        .unique();
      if (blocked && !existing) {
        await ctx.db.insert("blockedDates", { vendorId: vendor._id, date });
        changed++;
      } else if (!blocked && existing) {
        await ctx.db.delete(existing._id);
        changed++;
      }
    }
    return { changed };
  },
});

export const setMultipleBookingsPerDay = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const { vendor } = await requireEditableVendor(ctx);
    await ctx.db.patch(vendor._id, { multipleBookingsPerDay: enabled });
  },
});
