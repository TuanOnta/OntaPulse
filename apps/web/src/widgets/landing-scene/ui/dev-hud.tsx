import { useEffect, useState } from "react";

import type { SceneStats } from "../model/create-scene";

type Listener = (stats: SceneStats) => void;

let listener: Listener | null = null;

/** Called by the scene (dev only) about every 10 frames. */
export function publishSceneStats(stats: SceneStats): void {
  listener?.(stats);
}

/** Dev-only HUD (?debug): fps, pixel ratio, tier, scroll progress, draw calls. */
export default function DevHud() {
  const [text, setText] = useState("");
  useEffect(() => {
    listener = (s) =>
      setText(
        `tier ${s.tier}   dpr ${s.dpr.toFixed(2)}   ${s.fps.toFixed(0)} fps\n` +
          `f ${s.f.toFixed(2)}   q ${s.q.toFixed(2)} r ${s.r.toFixed(2)} d ${s.d.toFixed(2)}\n` +
          `calls ${s.calls}   tris ${s.triangles}   pts ${s.points}   beacons ${s.beacons}${s.throttled ? "   (30fps idle)" : ""}`,
      );
    return () => {
      listener = null;
    };
  }, []);
  return (
    <pre
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 left-3 z-50 m-0 rounded-lg bg-black/75 px-2.5 py-2 font-mono text-[11px] leading-normal whitespace-pre text-landing-accent"
    >
      {text}
    </pre>
  );
}
