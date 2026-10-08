import type { PointerEvent } from "react";

import { prefersReducedMotion } from "./reduced-motion";

/** Maximum tilt in degrees around the Y axis (left/right) and the X axis (up/down). */
export const TILT_MAX = { y: 6, x: 5 } as const;

/**
 * Pointer handler for the card hover effect. It writes the pointer position into the CSS variables
 * `--mx` / `--my` (spotlight) and the tilt angles into `--ry` / `--rx`. Direct style writes keep
 * React state out of pointer moves; under reduced motion nothing is written.
 */
export function trackSpotlight(event: PointerEvent<HTMLElement>): void {
  if (prefersReducedMotion()) return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  el.style.setProperty("--mx", `${x}px`);
  el.style.setProperty("--my", `${y}px`);
  el.style.setProperty("--ry", `${((x / rect.width - 0.5) * TILT_MAX.y).toFixed(2)}deg`);
  el.style.setProperty("--rx", `${((0.5 - y / rect.height) * TILT_MAX.x).toFixed(2)}deg`);
}

/** Pointer-leave handler: levels the card again. */
export function resetTilt(event: PointerEvent<HTMLElement>): void {
  const el = event.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}

/** Spotlight only (no tilt): writes the pointer position into `--mx` / `--my`. */
export function trackPointer(event: PointerEvent<HTMLElement>): void {
  if (prefersReducedMotion()) return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  el.style.setProperty("--my", `${event.clientY - rect.top}px`);
}
