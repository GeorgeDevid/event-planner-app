/**
 * Where to go after logging in or signing up, e.g. back to the vendor a
 * visitor wanted to message (C-01 #6). Only in-app paths are accepted.
 */
const KEY = "after-auth";

export const safeNext = (value: string | null | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;

export function rememberNext(value: string | null | undefined) {
  const next = safeNext(value);
  if (!next) return;
  try {
    window.sessionStorage.setItem(KEY, next);
  } catch {
    // storage unavailable: they'll land on their home page instead
  }
}

export function takeNext(prefix?: string) {
  try {
    const next = safeNext(window.sessionStorage.getItem(KEY));
    window.sessionStorage.removeItem(KEY);
    return next && (!prefix || next.startsWith(prefix)) ? next : null;
  } catch {
    return null;
  }
}

/** Sign-up link that brings the visitor back to `path` afterwards. */
export const signUpFor = (path: string) => `/sign-up?next=${encodeURIComponent(path)}`;
