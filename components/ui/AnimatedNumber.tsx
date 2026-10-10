"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/client/data";

/**
 * Smoothly chases its target with exponential easing, writing straight to the
 * DOM so dragging the Time Machine never triggers per-frame React renders.
 * The accessible value is exposed via aria-label on the final number only.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  tau = 110,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  /** Easing time constant in ms. */
  tau?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const raf = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !Number.isFinite(shown.current) || !Number.isFinite(value)) {
      shown.current = value;
      el.textContent = fmt.current(value);
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      const k = 1 - Math.exp(-dt / tau);
      const diff = value - shown.current;
      // Close enough relative to magnitude → snap and stop.
      if (Math.abs(diff) <= Math.max(Math.abs(value) * 1e-5, 0.004)) {
        shown.current = value;
        el.textContent = fmt.current(value);
        raf.current = null;
        return;
      }
      shown.current += diff * k;
      el.textContent = fmt.current(shown.current);
      raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [value, reduced, tau]);

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {format(value)}
    </span>
  );
}
