import { defineApp } from "convex/server";
import { v } from "convex/values";
import resend from "@convex-dev/resend/convex.config.js";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import authGoogle from "@convex-dev/auth/components/google/convex.config.js";
import geospatial from "@convex-dev/geospatial/convex.config.js";

const app = defineApp({
  env: {
    // Google OAuth client for "Continue with Google". Set both to "not-set"
    // until real credentials exist; the sign-in pages then hide the button.
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
  },
});

// Convex Auth: the core (sessions and tokens) must be mounted as `auth`.
app.use(auth);
// Sign-in method storage: password hashes and usernames (we use the email address as the username).
app.use(authPassword);
app.use(authUsername);
// "Continue with Google". Google calls back to <site url>/oauth/google/callback.
// Both values must exist to deploy; "not-set" keeps the button hidden (see auth.ts).
app.use(authGoogle, {
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
});
// Geospatial index for "vendors within X km" searches.
app.use(geospatial);
app.use(resend);

export default app;
