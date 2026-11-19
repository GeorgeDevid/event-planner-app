/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as admin from "../admin.js";
import type * as adminAudit from "../adminAudit.js";
import type * as adminCategories from "../adminCategories.js";
import type * as adminEventTypes from "../adminEventTypes.js";
import type * as adminOversight from "../adminOversight.js";
import type * as adminRoles from "../adminRoles.js";
import type * as adminUsers from "../adminUsers.js";
import type * as adminVendors from "../adminVendors.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as catalog from "../catalog.js";
import type * as content from "../content.js";
import type * as emailVerification from "../emailVerification.js";
import type * as events from "../events.js";
import type * as geocode from "../geocode.js";
import type * as inquiries from "../inquiries.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_sessions from "../lib/sessions.js";
import type * as lib_threads from "../lib/threads.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_vendorAccess from "../lib/vendorAccess.js";
import type * as notifications from "../notifications.js";
import type * as places from "../places.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vendorSearch from "../vendorSearch.js";
import type * as vendorStats from "../vendorStats.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  admin: typeof admin;
  adminAudit: typeof adminAudit;
  adminCategories: typeof adminCategories;
  adminEventTypes: typeof adminEventTypes;
  adminOversight: typeof adminOversight;
  adminRoles: typeof adminRoles;
  adminUsers: typeof adminUsers;
  adminVendors: typeof adminVendors;
  auth: typeof auth;
  bookings: typeof bookings;
  catalog: typeof catalog;
  content: typeof content;
  emailVerification: typeof emailVerification;
  events: typeof events;
  geocode: typeof geocode;
  inquiries: typeof inquiries;
  "lib/access": typeof lib_access;
  "lib/dates": typeof lib_dates;
  "lib/email": typeof lib_email;
  "lib/permissions": typeof lib_permissions;
  "lib/sessions": typeof lib_sessions;
  "lib/threads": typeof lib_threads;
  "lib/tokens": typeof lib_tokens;
  "lib/validators": typeof lib_validators;
  "lib/vendorAccess": typeof lib_vendorAccess;
  notifications: typeof notifications;
  places: typeof places;
  reports: typeof reports;
  seed: typeof seed;
  users: typeof users;
  vendorSearch: typeof vendorSearch;
  vendorStats: typeof vendorStats;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
  geospatial: import("@convex-dev/geospatial/_generated/component.js").ComponentApi<"geospatial">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
