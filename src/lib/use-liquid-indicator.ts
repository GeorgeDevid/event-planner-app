"use client";

import { useLayoutEffect, useRef } from "react";

type Box = { l: number; t: number; r: number; b: number };

const DURATION = 340;
// Leading edge: quick and decisive. Trailing edge: catches up and settles.
const LEAD = "cubic-bezier(0.32, 0.72, 0, 1)";
const SETTLE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * A highlight pill that flows between tabs like a drop of liquid: the edge
 * facing the new tab arrives first, the pill stretches (and thins a little)
 * to cover both, then the trailing edge catches up and it settles.
 *
 * The indicator is one element covering the container, revealed with a
 * rounded clip-path, so its pill shape never distorts (scaleX would squash
 * the rounded ends). Render it as the container's first child, behind the
 * items:
 *
 *   const { containerRef, indicatorRef } = useLiquidIndicator(activeKey, '[aria-current="page"]');
 *   <ul ref={containerRef} className="relative">
 *     <span ref={indicatorRef} aria-hidden className="liquid-indicator bg-navy-900" />
 *     ...items (position: relative)
 *   </ul>
 *
 * Reduced motion: the pill moves instantly.
 */
export function useLiquidIndicator<T extends HTMLElement>(activeKey: string | number | null | undefined, selector: string) {
  const containerRef = useRef<T>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const last = useRef<Box | null>(null);
  const anim = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const measure = (): Box | null => {
      const el = container.querySelector<HTMLElement>(selector);
      if (!el) return null;
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top };
    };
    const to = measure();
    // Corner radius from the tab itself, kept fixed while stretching, so the
    // pill stays a capsule instead of ballooning into an oval.
    const radius = to ? Math.min(to.r - to.l, to.b - to.t) / 2 : 999;
    const clip = (box: Box) => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      return `inset(${box.t}px ${w - box.r}px ${h - box.b}px ${box.l}px round ${radius}px)`;
    };

    const from = last.current;
    last.current = to;
    anim.current?.cancel();
    if (!to) {
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.opacity = "1";
    indicator.style.clipPath = clip(to);

    const moved = from && (Math.abs(from.l - to.l) > 1 || Math.abs(from.t - to.t) > 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || !moved || reduce) return;

    // Mid-flow shape: spans from 25% along the old position to the new
    // position's far edge, and thins by 2px across the direction of travel.
    const horizontal = Math.abs(to.l - from.l) >= Math.abs(to.t - from.t);
    const lerp = (a: number, b: number) => a + (b - a) * 0.25;
    const mid: Box = horizontal
      ? to.l > from.l
        ? { l: lerp(from.l, to.l), r: to.r, t: Math.max(from.t, to.t) + 2, b: Math.min(from.b, to.b) - 2 }
        : { l: to.l, r: lerp(from.r, to.r), t: Math.max(from.t, to.t) + 2, b: Math.min(from.b, to.b) - 2 }
      : to.t > from.t
        ? { t: lerp(from.t, to.t), b: to.b, l: Math.max(from.l, to.l) + 2, r: Math.min(from.r, to.r) - 2 }
        : { t: to.t, b: lerp(from.b, to.b), l: Math.max(from.l, to.l) + 2, r: Math.min(from.r, to.r) - 2 };

    anim.current = indicator.animate(
      [
        { clipPath: clip(from), easing: LEAD },
        { clipPath: clip(mid), offset: 0.45, easing: SETTLE },
        { clipPath: clip(to) },
      ],
      { duration: DURATION },
    );
  }, [activeKey, selector]);

  // Keep the pill on its item when the layout changes size (rotation, fonts loading).
  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const el = container.querySelector<HTMLElement>(selector);
      if (!el || anim.current?.playState === "running") return;
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const box = { l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top };
      last.current = box;
      const radius = Math.min(box.r - box.l, box.b - box.t) / 2;
      indicator.style.clipPath = `inset(${box.t}px ${container.clientWidth - box.r}px ${container.clientHeight - box.b}px ${box.l}px round ${radius}px)`;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [selector]);

  return { containerRef, indicatorRef };
}
