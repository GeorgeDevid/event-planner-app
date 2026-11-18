import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, requirePermission } from "./lib/access";
import { questionType } from "./lib/validators";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const keyify = (s: string) => {
  const words = s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).slice(0, 5);
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("") || "question";
};

/** A-06: every event type (active or not) with how many events use it. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "eventTypes:view");
    const types = await ctx.db.query("eventTypes").withIndex("by_order").collect();
    const events = await ctx.db.query("events").collect();
    const categories = await ctx.db.query("categories").withIndex("by_order").collect();
    return {
      types: types.map((t) => ({
        ...t,
        eventCount: events.filter((e) => e.eventTypeId === t._id && e.status !== "cancelled").length,
      })),
      categories: categories.filter((c) => !c.parentId).map((c) => ({ slug: c.slug, name: c.name, active: c.active })),
    };
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const admin = await requirePermission(ctx, "eventTypes:create");
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 40) invalid("Use a name between 2 and 40 characters.", "name");
    const all = await ctx.db.query("eventTypes").withIndex("by_order").collect();
    const slug = slugify(clean);
    if (all.some((t) => t.slug === slug || t.name.toLowerCase() === clean.toLowerCase())) {
      invalid("An event type with that name already exists.", "name");
    }
    const id = await ctx.db.insert("eventTypes", {
      name: clean,
      slug,
      order: all.length,
      active: true,
      defaultCategorySlugs: [],
      subFunctions: [],
      questions: [],
    });
    await audit(ctx, { actor: admin, action: "eventType.created", module: "eventTypes", targetTable: "eventTypes", targetId: id, after: { name: clean } });
    return id;
  },
});

/**
 * Save an event type's questions, sub-functions and default services
 * (A-06 #2-4). Existing questions keep their keys so saved answers still
 * match (#5).
 */
export const save = mutation({
  args: {
    eventTypeId: v.id("eventTypes"),
    name: v.string(),
    questions: v.array(
      v.object({
        key: v.optional(v.string()),
        label: v.string(),
        type: questionType,
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
      }),
    ),
    subFunctions: v.array(v.string()),
    defaultCategorySlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "eventTypes:edit");
    const type = await ctx.db.get(args.eventTypeId);
    if (!type) invalid("Event type not found.");
    const name = args.name.trim();
    if (name.length < 2 || name.length > 40) invalid("Use a name between 2 and 40 characters.", "name");
    const others = (await ctx.db.query("eventTypes").collect()).filter((t) => t._id !== type._id);
    if (others.some((t) => t.name.toLowerCase() === name.toLowerCase())) invalid("Another event type has that name.", "name");

    if (args.questions.length > 20) invalid("Up to 20 questions per event type.");
    const existingKeys = new Set(type.questions.map((q) => q.key));
    const used = new Set<string>();
    const questions: Doc<"eventTypes">["questions"] = args.questions.map((q, i) => {
      const label = q.label.trim();
      if (label.length < 2 || label.length > 120) invalid(`Question ${i + 1}: write a label (2 to 120 characters).`, `questions.${i}.label`);
      let options: string[] | undefined;
      if (q.type === "single_choice" || q.type === "multi_choice") {
        options = [...new Set((q.options ?? []).map((o) => o.trim()).filter(Boolean))];
        if (options.length < 2) invalid(`Question ${i + 1}: add at least two options.`, `questions.${i}.options`);
        if (options.length > 20 || options.some((o) => o.length > 60)) invalid(`Question ${i + 1}: up to 20 options of 60 characters.`, `questions.${i}.options`);
      }
      // Keep the key of an existing question; make a new unique one otherwise.
      let key = q.key && existingKeys.has(q.key) && !used.has(q.key) ? q.key : keyify(label);
      if (used.has(key) || (!q.key && existingKeys.has(key))) {
        let n = 2;
        while (used.has(`${key}${n}`) || existingKeys.has(`${key}${n}`)) n++;
        key = `${key}${n}`;
      }
      used.add(key);
      return { key, label, type: q.type, ...(options ? { options } : {}), required: q.required };
    });

    const subFunctions = [...new Set(args.subFunctions.map((s) => s.trim()).filter(Boolean))];
    if (subFunctions.length > 15 || subFunctions.some((s) => s.length > 40)) invalid("Up to 15 functions of 40 characters.", "subFunctions");

    const slugs = new Set((await ctx.db.query("categories").collect()).map((c) => c.slug));
    const defaults = [...new Set(args.defaultCategorySlugs)];
    if (defaults.some((s) => !slugs.has(s))) invalid("One of those services no longer exists.");

    await ctx.db.patch(type._id, { name, questions, subFunctions, defaultCategorySlugs: defaults });
    await audit(ctx, {
      actor: admin,
      action: "eventType.updated",
      module: "eventTypes",
      targetTable: "eventTypes",
      targetId: type._id,
      before: { name: type.name, questions: type.questions.length, subFunctions: type.subFunctions.length, defaults: type.defaultCategorySlugs.length },
      after: { name, questions: questions.length, subFunctions: subFunctions.length, defaults: defaults.length },
    });
  },
});

export const setActive = mutation({
  args: { eventTypeId: v.id("eventTypes"), active: v.boolean() },
  handler: async (ctx, { eventTypeId, active }) => {
    const admin = await requirePermission(ctx, "eventTypes:edit");
    const type = await ctx.db.get(eventTypeId);
    if (!type) invalid("Event type not found.");
    await ctx.db.patch(eventTypeId, { active });
    await audit(ctx, { actor: admin, action: active ? "eventType.activated" : "eventType.deactivated", module: "eventTypes", targetTable: "eventTypes", targetId: eventTypeId });
  },
});

export const move = mutation({
  args: { eventTypeId: v.id("eventTypes"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { eventTypeId, direction }) => {
    await requirePermission(ctx, "eventTypes:edit");
    const rows = await ctx.db.query("eventTypes").withIndex("by_order").collect();
    const i = rows.findIndex((r) => r._id === eventTypeId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i === -1 || !rows[j]) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [n, row] of rows.entries()) if (row.order !== n) await ctx.db.patch(row._id, { order: n });
  },
});

export const remove = mutation({
  args: { eventTypeId: v.id("eventTypes") },
  handler: async (ctx, { eventTypeId }) => {
    const admin = await requirePermission(ctx, "eventTypes:delete");
    const type = await ctx.db.get(eventTypeId);
    if (!type) invalid("Event type not found.");
    const used = (await ctx.db.query("events").collect()).filter((e) => e.eventTypeId === eventTypeId).length;
    if (used > 0) invalid(`${used} event${used === 1 ? " uses" : "s use"} this type. Deactivate it instead.`);
    await ctx.db.delete(eventTypeId);
    await audit(ctx, { actor: admin, action: "eventType.deleted", module: "eventTypes", targetTable: "eventTypes", targetId: eventTypeId, before: { name: type.name } });
  },
});
