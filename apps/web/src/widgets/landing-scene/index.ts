import { lazy } from "react";

export { useLifecycleKey } from "./model/lifecycle-store";
export type { LifecycleKey } from "./model/scroll-progress";
export { useLandingScroll } from "./model/use-landing-scroll";
export { SceneFallback } from "./ui/scene-fallback";

/** Lazy so `three` and the scene code load only on the landing route. */
export const LandingScene = lazy(() => import("./ui/landing-scene"));
export { createProgressBus, type ProgressBus } from "./model/progress-bus";
export { AUTH_KEYFRAMES, AUTH_PROGRESS } from "./model/scene-config";
export { readDevFlags, type DevFlags } from "./ui/dev-flags";
