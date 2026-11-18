import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import { syncVendorLocation } from "./vendorSearch";

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A-05: every category (active or not) with how many vendors use it. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "categories:view");
    const categories = await ctx.db.query("categories").withIndex("by_order").collect();
    const vendors = await ctx.db.query("vendors").collect();
    return categories.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      active: c.active,
      order: c.order,
      vendorCount: vendors.filter((v) => v.categoryIds.includes(c._id) && v.status !== "deactivated").length,
    }));
  },
});

export const create = mutation({
  args: { name: v.string(), icon: v.optional(v.string()) },
  handler: async (ctx, { name, icon }) => {
    const admin = await requirePermission(ctx, "categories:create");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) invalid("Use a name between 2 and 40 characters.");
    const slug = slugify(clean);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) invalid("A category with that name already exists.");
    const last = await ctx.db.query("categories").withIndex("by_order").order("desc").first();
    const id = await ctx.db.insert("categories", {
      name: clean,
      slug,
      icon: icon ?? "tag",
      order: (last?.order ?? -1) + 1,
      active: true,
    });
    await audit(ctx, {
      actor: admin,
      action: "category.created",
      module: "categories",
      targetTable: "categories",
      targetId: id,
      after: { name: clean },
    });
    return id;
  },
});

export const rename = mutation({
  args: { categoryId: v.id("categories"), name: v.string() },
  handler: async (ctx, { categoryId, name }) => {
    const admin = await requirePermission(ctx, "categories:edit");
    const category = await ctx.db.get(categoryId);
    if (!category) invalid("Category not found.");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) invalid("Use a name between 2 and 40 characters.");
    const clash = (await ctx.db.query("categories").collect()).find(
      (c) => c._id !== categoryId && c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (clash) invalid("A category with that name already exists.");
    // The slug stays the same so links and event-type defaults keep working.
    await ctx.db.patch(categoryId, { name: clean });
    await audit(ctx, {
      actor: admin,
      action: "category.renamed",
      module: "categories",
      targetTable: "categories",
      targetId: categoryId,
      before: { name: category.name },
      after: { name: clean },
    });
  },
});

/** Deactivated categories are hidden from clients and new vendors, and drop out of search. */
export const setActive = mutation({
  args: { categoryId: v.id("categories"), active: v.boolean() },
  handler: async (ctx, { categoryId, active }) => {
    const admin = await requirePermission(ctx, "categories:edit");
    const category = await ctx.db.get(categoryId);
    if (!category) invalid("Category not found.");
    await ctx.db.patch(categoryId, { active });
    const vendors = (await ctx.db.query("vendors").collect()).filter((v) =>
      v.categoryIds.includes(categoryId),
    );
    for (const vendor of vendors) await syncVendorLocation(ctx, vendor._id);
    await audit(ctx, {
      actor: admin,
      action: active ? "category.activated" : "category.deactivated",
      module: "categories",
      targetTable: "categories",
      targetId: categoryId,
    });
  },
});

export const move = mutation({
  args: { categoryId: v.id("categories"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { categoryId, direction }) => {
    const admin = await requirePermission(ctx, "categories:edit");
    const rows = await ctx.db.query("categories").withIndex("by_order").collect();
    const index = rows.findIndex((r) => r._id === categoryId);
    if (index === -1) invalid("Category not found.");
    const other = rows[direction === "up" ? index - 1 : index + 1];
    if (!other) return;
    // Renumber so orders stay unique even if they ever drifted.
    const reordered = [...rows];
    reordered[index] = other;
    reordered[direction === "up" ? index - 1 : index + 1] = rows[index];
    for (const [i, row] of reordered.entries()) {
      if (row.order !== i) await ctx.db.patch(row._id, { order: i });
    }
    await audit(ctx, {
      actor: admin,
      action: "category.reordered",
      module: "categories",
      targetTable: "categories",
      targetId: categoryId,
      after: { direction },
    });
  },
});

/** A category in use can't be deleted, only deactivated (A-05 #3). */
export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const admin = await requirePermission(ctx, "categories:delete");
    const category = await ctx.db.get(categoryId);
    if (!category) invalid("Category not found.");
    const inUse = (await ctx.db.query("vendors").collect()).filter((v) =>
      v.categoryIds.includes(categoryId),
    ).length;
    if (inUse > 0) {
      invalid(`In use by ${inUse} vendor${inUse === 1 ? "" : "s"}. Deactivate it instead.`);
    }
    const usedByEventTypes = (await ctx.db.query("eventTypes").collect()).filter((t) =>
      t.defaultCategorySlugs.includes(category.slug),
    );
    if (usedByEventTypes.length > 0) {
      invalid(
        `It's a default service for ${usedByEventTypes.map((t) => t.name).join(", ")}. Remove it there first, or deactivate it.`,
      );
    }
    await ctx.db.delete(categoryId);
    await audit(ctx, {
      actor: admin,
      action: "category.deleted",
      module: "categories",
      targetTable: "categories",
      targetId: categoryId,
      before: { name: category.name },
    });
  },
});
