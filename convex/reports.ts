import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { applySuspension } from "./adminUsers";
import { audit, requirePermission, requireUser, userCan } from "./lib/access";
import { loadThread, notify } from "./lib/threads";
import { syncVendorLocation } from "./vendorSearch";

function invalid(message: string, field?: string): never {
  throw new ConvexError({ code: "INVALID", message, ...(field ? { field } : {}) });
}

export const REASONS = ["Spam or scam", "Inappropriate content", "Harassment", "Fake or misleading", "Other"];

// ---------------------------------------------------------------------------
// Reporting (C-10 #5, C-13 #4)
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    targetType: v.union(v.literal("vendor"), v.literal("conversation")),
    vendorId: v.optional(v.id("vendors")),
    inquiryId: v.optional(v.id("inquiries")),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role === "admin") invalid("Admins handle reports in Moderation.");
    if (!REASONS.includes(args.reason)) invalid("Choose a reason.", "reason");
    const details = args.details?.trim() || undefined;
    if (details && details.length > 1000) invalid("Keep the details to 1,000 characters.", "details");
    if (args.reason === "Other" && !details) invalid("Tell us what's wrong.", "details");

    let vendorId = args.vendorId;
    if (args.targetType === "vendor") {
      const vendor = vendorId ? await ctx.db.get(vendorId) : null;
      if (!vendor) invalid("Vendor not found.");
      if (vendor.ownerId === user._id) invalid("You can't report your own business.");
    } else {
      if (!args.inquiryId) invalid("Conversation not found.");
      const t = await loadThread(ctx, args.inquiryId);
      if (t.role === "admin") invalid("Admins handle reports in Moderation.");
      vendorId = t.vendor._id;
    }

    const open = (await ctx.db.query("reports").collect()).find(
      (r) =>
        r.reporterId === user._id &&
        r.status !== "resolved" &&
        r.targetType === args.targetType &&
        (args.targetType === "vendor" ? r.vendorId === vendorId : r.inquiryId === args.inquiryId),
    );
    if (open) invalid("You've already reported this. Our team is looking at it.");

    return await ctx.db.insert("reports", {
      reporterId: user._id,
      targetType: args.targetType,
      vendorId,
      inquiryId: args.targetType === "conversation" ? args.inquiryId : undefined,
      reason: args.reason,
      details,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// A-08 moderation queue
// ---------------------------------------------------------------------------

export const list = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("in_review"), v.literal("resolved"))) },
  handler: async (ctx, { status }) => {
    await requirePermission(ctx, "reports:view");
    const rows = status
      ? await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", status)).order("desc").collect()
      : await ctx.db.query("reports").order("desc").collect();
    return Promise.all(
      rows.map(async (r) => {
        const reporter = await ctx.db.get(r.reporterId);
        const vendor = r.vendorId ? await ctx.db.get(r.vendorId) : null;
        return {
          _id: r._id,
          targetType: r.targetType,
          target: r.targetType === "vendor" ? (vendor?.companyName ?? "Vendor") : `Conversation with ${vendor?.companyName ?? "a vendor"}`,
          reporter: reporter?.name ?? reporter?.email ?? "User",
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
        };
      }),
    );
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:view");
    const rows = await ctx.db.query("reports").collect();
    return {
      open: rows.filter((r) => r.status === "open").length,
      in_review: rows.filter((r) => r.status === "in_review").length,
      resolved: rows.filter((r) => r.status === "resolved").length,
    };
  },
});

export const detail = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const admin = await requirePermission(ctx, "reports:view");
    const r = await ctx.db.get(reportId);
    if (!r) return null;
    const reporter = await ctx.db.get(r.reporterId);
    const vendor = r.vendorId ? await ctx.db.get(r.vendorId) : null;
    const owner = vendor ? await ctx.db.get(vendor.ownerId) : null;

    let conversation = null;
    if (r.inquiryId && (await userCan(ctx, admin, "messages:view"))) {
      const inquiry = await ctx.db.get(r.inquiryId);
      if (inquiry) {
        const client = await ctx.db.get(inquiry.clientId);
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiry._id))
          .collect();
        conversation = {
          client: { _id: inquiry.clientId, name: client?.name ?? "Client", status: client?.status ?? null },
          messages: await Promise.all(
            messages.map(async (m) => ({
              _id: m._id,
              from: m.from,
              body: m.body,
              quote: m.quote ?? null,
              removed: !!m.removedAt,
              images: (await Promise.all((m.imageIds ?? []).map((id) => ctx.storage.getUrl(id)))).filter(
                (u): u is string => !!u,
              ),
              createdAt: m.createdAt,
            })),
          ),
        };
      }
    }

    const resolver = r.resolvedBy ? await ctx.db.get(r.resolvedBy) : null;
    return {
      _id: r._id,
      targetType: r.targetType,
      reason: r.reason,
      details: r.details ?? null,
      status: r.status,
      createdAt: r.createdAt,
      resolution: r.resolution ?? null,
      action: r.action ?? null,
      resolvedBy: resolver?.name ?? null,
      resolvedAt: r.resolvedAt ?? null,
      reporter: { _id: r.reporterId, name: reporter?.name ?? "User", role: reporter?.role ?? null },
      vendor: vendor
        ? {
            _id: vendor._id,
            companyName: vendor.companyName,
            status: vendor.status,
            owner: { _id: vendor.ownerId, name: owner?.name ?? vendor.ownerName, status: owner?.status ?? null },
          }
        : null,
      conversation,
    };
  },
});

export const setInReview = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const admin = await requirePermission(ctx, "reports:edit");
    const r = await ctx.db.get(reportId);
    if (!r || r.status !== "open") invalid("Only open reports can be moved to In review.");
    await ctx.db.patch(reportId, { status: "in_review" });
    await audit(ctx, { actor: admin, action: "report.in_review", module: "reports", targetTable: "reports", targetId: reportId });
  },
});

const ACTIONS = ["dismiss", "remove_message", "warn_user", "suspend_vendor", "suspend_user"] as const;

/** Resolve with a note and an action (A-08 #2, #3). */
export const resolve = mutation({
  args: {
    reportId: v.id("reports"),
    action: v.union(...ACTIONS.map((a) => v.literal(a))),
    note: v.string(),
    messageId: v.optional(v.id("messages")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, "reports:edit");
    const r = await ctx.db.get(args.reportId);
    if (!r || r.status === "resolved") invalid("This report is already resolved.");
    const note = args.note.trim();
    if (note.length < 5) invalid("Write a resolution note (at least 5 characters).", "note");
    if (note.length > 1000) invalid("Keep the note to 1,000 characters.", "note");
    const vendor = r.vendorId ? await ctx.db.get(r.vendorId) : null;

    // The people this report is about: the vendor owner, and for a
    // conversation, the client too.
    const inquiry = r.inquiryId ? await ctx.db.get(r.inquiryId) : null;
    const involved = new Set<string>([vendor?.ownerId, inquiry?.clientId].filter((x): x is NonNullable<typeof x> => !!x));

    switch (args.action) {
      case "dismiss":
        break;
      case "remove_message": {
        if (!args.messageId) invalid("Choose the message to remove.");
        const m = await ctx.db.get(args.messageId);
        if (!m || m.inquiryId !== r.inquiryId) invalid("That message isn't in the reported conversation.");
        await ctx.db.patch(m._id, { removedAt: Date.now() });
        break;
      }
      case "warn_user": {
        const target = args.userId ?? vendor?.ownerId;
        if (!target || !involved.has(target)) invalid("Choose who to warn.");
        await notify(ctx, target, { title: "A message from the Event Planner team", body: note });
        break;
      }
      case "suspend_vendor": {
        await requirePermission(ctx, "vendors:suspend");
        if (!vendor) invalid("No vendor to suspend.");
        if (vendor.status !== "approved" && vendor.status !== "pending") invalid(`This vendor is ${vendor.status} already.`);
        await ctx.db.patch(vendor._id, { status: "suspended" });
        await syncVendorLocation(ctx, vendor._id);
        await audit(ctx, {
          actor: admin,
          action: "vendor.suspended",
          module: "vendors",
          targetTable: "vendors",
          targetId: vendor._id,
          before: { status: vendor.status },
          after: { status: "suspended", reason: `Report: ${note}` },
        });
        break;
      }
      case "suspend_user": {
        await requirePermission(ctx, "users:suspend");
        if (!args.userId || !involved.has(args.userId)) invalid("Choose who to suspend.");
        const user = (await ctx.db.get(args.userId)) as Doc<"users"> | null;
        if (!user) invalid("User not found.");
        if (user._id === admin._id) invalid("You can't suspend yourself.");
        if (user.status !== "suspended") await applySuspension(ctx, admin, user, true, `Report: ${note}`);
        break;
      }
    }

    await ctx.db.patch(r._id, {
      status: "resolved",
      resolution: note,
      action: args.action,
      resolvedBy: admin._id,
      resolvedAt: Date.now(),
    });
    await notify(ctx, r.reporterId, {
      title: "We reviewed your report",
      body: "Thanks for letting us know. Our team has looked into it and taken the action it needed.",
    });
    await audit(ctx, {
      actor: admin,
      action: `report.resolved.${args.action}`,
      module: "reports",
      targetTable: "reports",
      targetId: r._id,
      after: { note },
    });
  },
});
