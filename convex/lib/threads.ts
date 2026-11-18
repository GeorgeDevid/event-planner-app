import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./access";
import { sendEmail } from "./email";
import { hasPermission } from "./permissions";

type Ctx = QueryCtx | MutationCtx;
export type ThreadRole = "client" | "vendor" | "admin";

/** Who may read an inquiry thread (C-13 #5). */
export async function loadThread(ctx: Ctx, inquiryId: Id<"inquiries">) {
  const user = await requireUser(ctx);
  const inquiry = await ctx.db.get(inquiryId);
  const notFound = () => new ConvexError({ code: "NOT_FOUND", message: "Conversation not found." });
  if (!inquiry) throw notFound();
  const vendor = await ctx.db.get(inquiry.vendorId);
  if (!vendor) throw notFound();

  let role: ThreadRole | null = null;
  if (user.role === "client" && inquiry.clientId === user._id) role = "client";
  else if (user.role === "vendor" && vendor.ownerId === user._id) role = "vendor";
  else if (user.role === "admin" && hasPermission(user.adminRole, "messages:view")) {
    // Moderators only read threads that someone reported (A-10).
    if (user.adminRole === "moderator") {
      const report = await ctx.db
        .query("reports")
        .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiryId))
        .first();
      if (report) role = "admin";
    } else {
      role = "admin";
    }
  }
  if (!role) throw notFound();
  return { user, inquiry, vendor, role };
}

/** Participants only: admins can read but not post. */
export async function requireParticipant(
  ctx: Ctx,
  inquiryId: Id<"inquiries">,
  only?: "client" | "vendor",
) {
  const t = await loadThread(ctx, inquiryId);
  if (t.role === "admin" || (only && t.role !== only)) {
    throw new ConvexError({ code: "FORBIDDEN", message: "You can't do that in this conversation." });
  }
  return t as typeof t & { role: "client" | "vendor" };
}

export async function postMessage(
  ctx: MutationCtx,
  inquiry: Doc<"inquiries">,
  message: Omit<Doc<"messages">, "_id" | "_creationTime" | "inquiryId" | "createdAt">,
) {
  const now = Date.now();
  const id = await ctx.db.insert("messages", { ...message, inquiryId: inquiry._id, createdAt: now });
  const patch: Partial<Doc<"inquiries">> = { lastMessageAt: now };
  // Sending a message means you've read the thread up to it.
  if (message.from === "client") patch.clientLastReadAt = now;
  if (message.from === "vendor") patch.vendorLastReadAt = now;
  await ctx.db.patch(inquiry._id, patch);
  return id;
}

/** In-app notification, also sent by email when the user has an address. */
export async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  n: { title: string; body?: string; href?: string },
) {
  await ctx.db.insert("notifications", { userId, ...n, createdAt: Date.now() });
  const user = await ctx.db.get(userId);
  if (user?.email && user.status === "active" && !user.deletedAt) {
    await sendEmail(ctx, user.email, {
      subject: n.title,
      heading: n.title,
      body: n.body,
      cta: n.href ? { label: "Open Event Planner", href: n.href } : undefined,
    });
  }
}

/** Unread messages in a thread for one side. */
export async function unreadFor(ctx: Ctx, inquiry: Doc<"inquiries">, side: "client" | "vendor") {
  const since = (side === "client" ? inquiry.clientLastReadAt : inquiry.vendorLastReadAt) ?? 0;
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_inquiry", (q) => q.eq("inquiryId", inquiry._id).gt("createdAt", since))
    .collect();
  return rows.filter((m) => m.from !== side).length;
}

export const OPEN_INQUIRY = ["sent", "quoted"] as const;
export const isOpen = (i: Doc<"inquiries">) => i.status === "sent" || i.status === "quoted";
