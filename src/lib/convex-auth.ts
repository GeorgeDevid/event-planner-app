import "server-only";
import { setupConvexAuthServer } from "@convex-dev/auth/ssr";
import { setupConvexAuthNextjs } from "@convex-dev/auth/ssr/nextjs";
import { api } from "../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to create .env.local.",
  );
}

const secure = process.env.NODE_ENV === "production";

/** Next.js helpers: the proxy, server-side session checks and the provider. */
export const {
  convexAuthNextjsProxy,
  nextjsProxyRedirect,
  convexAuthNextjsAccessToken,
  isAuthenticatedNextjs,
  ConvexAuthNextjsServerProvider,
} = setupConvexAuthNextjs({
  convexUrl,
  refreshSession: api.auth.refreshSession,
  isAuthenticated: api.auth.isAuthenticated,
  cookieOptions: { secure },
});

/** Route handlers mounted under /auth (sign-in, refresh, sign-out). */
export const authServer = setupConvexAuthServer({
  convexUrl,
  refreshSession: api.auth.refreshSession,
  signOut: api.auth.signOut,
  signIn: [
    api.auth.signInWithUsernamePassword,
    api.auth.signUpWithUsernamePassword,
  ],
  cookieOptions: { secure },
});
