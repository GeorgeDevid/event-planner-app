"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type MyVendor = FunctionReturnType<typeof api.vendors.mine>;

/** The signed-in vendor's business, or undefined while loading. */
export function useMyVendor() {
  return useQuery(api.vendors.mine);
}
