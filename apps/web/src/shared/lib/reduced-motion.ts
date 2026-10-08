const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user asked the OS or browser for reduced motion. Safe where matchMedia is absent. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_QUERY).matches
    : false;
}
