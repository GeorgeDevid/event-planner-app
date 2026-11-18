import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Sign a user out everywhere (used on suspension and deletion, A-03). */
export async function revokeAllSessions(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.runQuery(components.auth.public.listSessions, { userId });
  if (sessions.length === 0) return 0;
  const revoked = await ctx.runMutation(components.auth.public.revokeSessions, {
    sessionIds: sessions.map((s) => s.sessionId),
  });
  return revoked.length;
}
