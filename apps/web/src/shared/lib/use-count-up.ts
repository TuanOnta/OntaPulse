import { useEffect, useState } from "react";

import { prefersReducedMotion } from "./reduced-motion";

export const COUNT_UP_MS = 700;

/** Counts from 0 to `target` with an ease-out cubic. No animation under reduced motion or for 0. */
export function useCountUp(target: number, duration = COUNT_UP_MS): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (target === 0 || prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
