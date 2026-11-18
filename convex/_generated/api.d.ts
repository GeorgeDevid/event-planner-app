/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminAudit from "../adminAudit.js";
import type * as adminCategories from "../adminCategories.js";
import type * as adminUsers from "../adminUsers.js";
import type * as adminVendors from "../adminVendors.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as geocode from "../geocode.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_sessions from "../lib/sessions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_vendorAccess from "../lib/vendorAccess.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vendorSearch from "../vendorSearch.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAudit: typeof adminAudit;
  adminCategories: typeof adminCategories;
  adminUsers: typeof adminUsers;
  adminVendors: typeof adminVendors;
  auth: typeof auth;
  catalog: typeof catalog;
  geocode: typeof geocode;
  "lib/access": typeof lib_access;
  "lib/permissions": typeof lib_permissions;
  "lib/sessions": typeof lib_sessions;
  "lib/validators": typeof lib_validators;
  "lib/vendorAccess": typeof lib_vendorAccess;
  seed: typeof seed;
  users: typeof users;
  vendorSearch: typeof vendorSearch;
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
};
