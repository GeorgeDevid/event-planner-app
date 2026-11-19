"use client";

import { useEffect, useState } from "react";

/**
 * True while `open`, and for `ms` after it turns false, so a dialog's content
 * stays on screen while its closing animation plays, then unmounts (which
 * resets any form inside for next time).
 */
export function useLingering(open: boolean, ms: number) {
  const [lingering, setLingering] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLingering(true);
  }
  useEffect(() => {
    if (open || !lingering) return;
    const t = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(t);
  }, [open, lingering, ms]);
  return open || lingering;
}
