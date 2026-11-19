"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { rememberNext } from "@/lib/next-path";

/** Stores ?next= so we can return there after login or sign-up. */
export function RememberNext() {
  const next = useSearchParams().get("next");
  useEffect(() => rememberNext(next), [next]);
  return null;
}
