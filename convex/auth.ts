import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { query } from "./_generated/server";
import { components, internal } from "./_generated/api";

// Core session handling (sign out, refresh, "am I signed in?").
const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

// Email + password sign-in. The email address is stored as the username.
export const { signUpWithUsernamePassword, signInWithUsernamePassword } =
  setupUsernamePassword(auth, {
    component: components.authPassword,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({
    createUser: internal.users.createUserPassword,
    onSignIn: internal.users.onSignIn,
  });

// Sites Google may send people back to after signing in (open-redirect
// protection): the live site, local development, and any extra origins
// listed in AUTH_REDIRECT_ORIGINS (comma-separated).
const allowedRedirectOrigins = [
  process.env.APP_URL ?? "https://event-planner-app-woad.vercel.app",
  "http://localhost:3000",
  "http://localhost:3123",
  ...(process.env.AUTH_REDIRECT_ORIGINS ?? "").split(","),
]
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// "Continue with Google": signs in, or signs up and goes through onboarding.
export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(auth, {
  component: components.authGoogle,
  allowedRedirectOrigins,
}).attachUserCallbacks({
  createUser: internal.users.createUserGoogle,
  onSignIn: internal.users.onSignInGoogle,
});

/** Which sign-in options to show. Google appears once real credentials are set. */
export const signInOptions = query({
  args: {},
  handler: async () => {
    const id = process.env.AUTH_GOOGLE_CLIENT_ID ?? "";
    return { google: id.endsWith(".apps.googleusercontent.com") };
  },
});
