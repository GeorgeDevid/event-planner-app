import { ConvexError } from "convex/values";

/** The user-facing message from a failed Convex call. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    if (typeof data === "string") return data;
    if (data?.message) return data.message;
  }
  if (err instanceof Error && err.message.startsWith("Upload failed")) return err.message;
  return fallback;
}
