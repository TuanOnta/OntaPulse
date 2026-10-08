import type { CSSProperties } from "react";

/** Delay of the entrance rise, in steps of 60 ms (the prototype's `--i`). */
export const RISE_STEP_MS = 60;

export function riseStyle(index: number): CSSProperties {
  return { animationDelay: `${index * RISE_STEP_MS}ms` };
}
