import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { audit, requireUser } from "./lib/access";

const MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "Use at least 10 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  PASSWORD_HAS_SURROUNDING_WHITESPACE: "Remove spaces at the start or end.",
  PASSWORD_TOO_COMMON: "That password is too common. Choose something harder to guess.",
  INVALID_CREDENTIALS: "Your current password isn't right.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
};

/** Change my password after confirming the current one. */
export const changePassword = mutation({
  args: { current: v.string(), next: v.string() },
  handler: async (ctx, { current, next }) => {
    const user = await requireUser(ctx);
    if (current === next) {
      throw new ConvexError({ code: "INVALID", field: "next", message: "Choose a password different from your current one." });
    }
    const check = await ctx.runMutation(components.authPassword.public.verifyPassword, {
      userId: user._id,
      password: current,
    });
    if (!check.success) {
      throw new ConvexError({
        code: "INVALID",
        field: "current",
        message: MESSAGES[check.userError.error] ?? "Your current password isn't right.",
      });
    }
    // The current password was just verified, which is the case the
    // component's setter is meant for.
    const result = await ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
      userId: user._id,
      password: next,
      minimumLength: 10,
    });
    if (!result.success) {
      throw new ConvexError({
        code: "INVALID",
        field: "next",
        message: MESSAGES[result.userError.error] ?? "Choose a different password.",
      });
    }
    await audit(ctx, { actor: user, action: "user.password_changed", module: "users", targetTable: "users", targetId: user._id });
  },
});
