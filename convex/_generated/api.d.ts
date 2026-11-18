/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vendorSearch from "../vendorSearch.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  catalog: typeof catalog;
  "lib/access": typeof lib_access;
  "lib/permissions": typeof lib_permissions;
  "lib/validators": typeof lib_validators;
  seed: typeof seed;
  users: typeof users;
  vendorSearch: typeof vendorSearch;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
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
