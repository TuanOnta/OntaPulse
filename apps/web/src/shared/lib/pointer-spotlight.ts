import type { PointerEvent } from "react";

import { prefersReducedMotion } from "./reduced-motion";

/**
 * Pointer handler for a "spotlight" hover effect: writes the pointer position into the CSS variables
 * `--mx` / `--my` of the element. Direct style writes keep React state out of pointer moves.
 */
export function trackSpotlight(event: PointerEvent<HTMLElement>): void {
  if (prefersReducedMotion()) return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  el.style.setProperty("--my", `${event.clientY - rect.top}px`);
}
