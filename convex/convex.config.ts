import { defineApp } from "convex/server";
import auth from "@convex-dev/auth/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import authUsername from "@convex-dev/auth/components/username/convex.config.js";
import geospatial from "@convex-dev/geospatial/convex.config.js";

const app = defineApp();

// Convex Auth: the core (sessions and tokens) must be mounted as `auth`.
app.use(auth);
// Sign-in method storage: password hashes and usernames (we use the email address as the username).
app.use(authPassword);
app.use(authUsername);
// Geospatial index for "vendors within X km" searches.
app.use(geospatial);

export default app;
