import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { components, internal } from "./_generated/api";

// Core session handling (sign out, refresh, "am I signed in?").
const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

// Email + password sign-in. The email address is stored as the username.
// Email verification and Google sign-in come in a later step (they need a
// Resend API key and Google OAuth credentials).
export const { signUpWithUsernamePassword, signInWithUsernamePassword } =
  setupUsernamePassword(auth, {
    component: components.authPassword,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({
    createUser: internal.users.createUserPassword,
    onSignIn: internal.users.onSignIn,
  });
