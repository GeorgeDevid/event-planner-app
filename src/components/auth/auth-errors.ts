import { ConvexError } from "convex/values";

type UserError = { error: string; cause?: unknown; minimumLength?: number; retryAfterMs?: number };

/** Plain-language messages for Convex Auth's sign-in and sign-up errors. */
export function authErrorMessage(userError: UserError): string {
  switch (userError.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "That email and password don't match. Check them and try again.";
    case "USERNAME_TAKEN":
      return "An account already uses this email. Log in instead.";
    case "USERNAME_HAS_INVALID_CHARACTERS":
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
      return "Enter a valid email address.";
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${userError.minimumLength ?? 10} characters for your password.`;
    case "PASSWORD_TOO_LONG":
      return "That password is too long.";
    case "PASSWORD_TOO_COMMON":
      return "That password is too common. Choose one that's harder to guess.";
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Remove the spaces at the start or end of your password.";
    case "RATE_LIMITED": {
      const minutes = Math.max(1, Math.ceil((userError.retryAfterMs ?? 60_000) / 60_000));
      return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    default: {
      const cause = userError.cause;
      if (cause instanceof ConvexError) {
        const data = cause.data as { message?: string } | string;
        if (typeof data === "string") return data;
        if (data?.message) return data.message;
      }
      return "Something went wrong. Please try again.";
    }
  }
}
