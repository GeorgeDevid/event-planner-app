import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireRole } from "./access";

type Ctx = QueryCtx | MutationCtx;

/** The signed-in vendor's business. */
export async function requireMyVendor(
  ctx: Ctx,
): Promise<{ user: Doc<"users">; vendor: Doc<"vendors"> }> {
  const user = await requireRole(ctx, "vendor");
  const vendor = await ctx.db
    .query("vendors")
    .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
    .unique();
  if (!vendor) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "We couldn't find your business. Contact support.",
    });
  }
  return { user, vendor };
}

/** Same, but refuses businesses that an admin has suspended or deactivated. */
export async function requireEditableVendor(ctx: Ctx) {
  const result = await requireMyVendor(ctx);
  if (result.vendor.status === "suspended" || result.vendor.status === "deactivated") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Your business is not active, so it can't be changed. Contact support.",
    });
  }
  return result;
}

/** Mean of the active package prices, or undefined with none (V-04, C-09). */
export async function recomputeAvgPrice(ctx: MutationCtx, vendorId: Id<"vendors">) {
  const packages = await ctx.db
    .query("packages")
    .withIndex("by_vendor", (q) => q.eq("vendorId", vendorId))
    .collect();
  const active = packages.filter((p) => p.active);
  const avgPriceCents =
    active.length === 0
      ? undefined
      : Math.round(active.reduce((sum, p) => sum + p.priceCents, 0) / active.length);
  await ctx.db.patch(vendorId, { avgPriceCents });
  return avgPriceCents;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_PORTFOLIO = 30;

/**
 * Check an uploaded file's type and size. Rejected files are deleted from
 * storage so they don't linger.
 */
export async function checkUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  allowed: { types: string[]; maxBytes: number; label: string },
) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Upload not found. Try again." });
  }
  const type = meta.contentType ?? "";
  if (!allowed.types.includes(type)) {
    await ctx.storage.delete(storageId);
    throw new ConvexError({
      code: "INVALID_FILE",
      message: `That file type isn't supported. Use ${allowed.label}.`,
    });
  }
  if (meta.size > allowed.maxBytes) {
    await ctx.storage.delete(storageId);
    throw new ConvexError({
      code: "INVALID_FILE",
      message: `That file is too large. The limit is ${Math.round(allowed.maxBytes / 1024 / 1024)} MB.`,
    });
  }
  return meta;
}
