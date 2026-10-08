import { lazy, Suspense, useEffect, useRef } from "react";

import { progressBus, type ProgressBus } from "../model/progress-bus";
import {
  FINE_POINTER_QUERY,
  LOW_TIER_QUERY,
  TOKEN_NAMES,
  type Keyframe,
} from "../model/scene-config";
import type { LandingScene as SceneHandle, SceneColors } from "../model/create-scene";
import { readDevFlags } from "./dev-flags";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// The dev HUD is only referenced behind import.meta.env.DEV, so production builds drop it.
const DevHud = import.meta.env.DEV ? lazy(() => import("./dev-hud")) : null;

function readColors(): SceneColors {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string): string => css.getPropertyValue(name).trim();
  return {
    accent: token(TOKEN_NAMES.accent),
    info: token(TOKEN_NAMES.info),
    warn: token(TOKEN_NAMES.warn),
    danger: token(TOKEN_NAMES.danger),
    muted: token(TOKEN_NAMES.muted),
  };
}

/**
 * Owns the decorative WebGL canvas. The imperative scene is created inside the mount effect (and
 * loaded with a dynamic import, so `three` lives in its own chunk) and fully disposed on cleanup.
 * It holds no React state.
 */
export type LandingSceneProps = {
  /** Scroll progress source. Defaults to the landing page bus. */
  progress?: ProgressBus;
  /** Scene poses. Defaults to the landing page keyframes. */
  keyframes?: readonly Keyframe[];
};

export default function LandingScene({ progress = progressBus, keyframes }: LandingSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const flags = readDevFlags();
    if (flags.webglOff) return;

    let cancelled = false;
    let scene: SceneHandle | null = null;
    const teardown: Array<() => void> = [];

    void import("../model/create-scene").then(async ({ createLandingScene }) => {
      if (cancelled) return;
      const reducedQuery = window.matchMedia(REDUCED_QUERY);
      const isReduced = (): boolean => reducedQuery.matches || flags.reduceMotion;
      const tier = flags.quality ?? (window.matchMedia(LOW_TIER_QUERY).matches ? "low" : "high");

      let onStats: ((stats: import("../model/create-scene").SceneStats) => void) | undefined;
      if (import.meta.env.DEV && flags.debug) {
        const { publishSceneStats } = await import("./dev-hud");
        if (cancelled) return;
        onStats = publishSceneStats;
      }

      const created = createLandingScene(canvas, {
        tier,
        reduced: isReduced(),
        colors: readColors(),
        keyframes,
        onContextLost: () => {
          canvas.style.opacity = "0";
        },
        onStats,
      });
      if (!created) return; // no WebGL: the page shows its content without the orb
      scene = created;

      const sync = (): void =>
        created.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      sync();
      window.addEventListener("resize", sync);
      teardown.push(() => window.removeEventListener("resize", sync));

      if (window.matchMedia(FINE_POINTER_QUERY).matches) {
        const onPointer = (e: PointerEvent): void =>
          created.setPointer(
            (e.clientX / window.innerWidth) * 2 - 1,
            (e.clientY / window.innerHeight) * 2 - 1,
          );
        window.addEventListener("pointermove", onPointer, { passive: true });
        teardown.push(() => window.removeEventListener("pointermove", onPointer));
      }

      const onVisibility = (): void => (document.hidden ? created.stop() : created.start());
      document.addEventListener("visibilitychange", onVisibility);
      teardown.push(() => document.removeEventListener("visibilitychange", onVisibility));

      const onReducedChange = (): void => created.setReduced(isReduced());
      reducedQuery.addEventListener("change", onReducedChange);
      teardown.push(() => reducedQuery.removeEventListener("change", onReducedChange));

      teardown.push(progress.subscribe((f) => created.setScroll(f)));
      created.setScroll(progress.get());
      created.start();
      if (isReduced()) created.setReduced(true);
    });

    return () => {
      cancelled = true;
      teardown.forEach((fn) => fn());
      scene?.dispose();
      scene = null;
    };
  }, [progress, keyframes]);

  return (
    <>
      <canvas
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-0"
        data-testid="landing-canvas"
        ref={canvasRef}
        tabIndex={-1}
      />
      {DevHud && readDevFlags().debug ? (
        <Suspense fallback={null}>
          <DevHud />
        </Suspense>
      ) : null}
    </>
  );
}
