"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

/**
 * Landing-page section that fades and rises in the first time it scrolls into
 * view (see the `reveal` / `reveal-items` utilities). Marketing pages only: never on screens
 * people use every day.
 */
export function Reveal({ className = "", items = false, ...props }: ComponentPropsWithoutRef<"div"> & {
  /** Animate the `.reveal-item` children one after another (`--i` sets the order) instead of the whole block. */
  items?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} data-visible={visible ? "" : undefined} className={`${items ? "reveal-items" : "reveal"} ${className}`} {...props} />;
}
