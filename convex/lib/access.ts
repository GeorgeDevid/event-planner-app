import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasPermission, type Permission } from "./permissions";
import type { UserRole } from "./validators";

type Ctx = QueryCtx | MutationCtx;

/** The signed-in user's record, or null. Suspended users count as signed out. */
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user || user.status === "suspended") return null;
  return user;
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please log in." });
  }
  return user;
}

export async function requireRole(
  ctx: Ctx,
  role: UserRole,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== role) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You don't have access to this.",
    });
  }
  return user;
}

/** An admin with the given permission (A-10); everyone else gets FORBIDDEN. */
export async function requirePermission(
  ctx: Ctx,
  permission: Permission,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin" || !hasPermission(user.adminRole, permission)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You don't have permission to do this.",
    });
  }
  return user;
}

/** Append a read-only entry to the audit log (A-11). */
export async function audit(
  ctx: MutationCtx,
  entry: {
    actor: Doc<"users"> | null;
    action: string;
    module: string;
    targetTable?: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await ctx.db.insert("auditLog", {
    actorId: entry.actor?._id,
    actorRole: entry.actor
      ? (entry.actor.adminRole ?? entry.actor.role)
      : undefined,
    action: entry.action,
    module: entry.module,
    targetTable: entry.targetTable,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    at: Date.now(),
  });
}
