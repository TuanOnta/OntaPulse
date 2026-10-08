import type { Keyframe } from "./scene-config";

export type LifecycleKey = "queued" | "running" | "done" | "";
export type LifecycleWeights = { q: number; r: number; d: number };

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Maps scroll progress `f` to the QUEUED / RUNNING / DONE look of the orb while the user scrolls
 * through "How it works" (f from 1.0 to 2.0). Outside that range the orb looks DONE.
 */
export function lifecycleWeightsInto(f: number, out: LifecycleWeights): LifecycleWeights {
  if (f <= 0.85 || f >= 2.0) {
    out.q = 0;
    out.r = 0;
    out.d = 1;
  } else if (f < 1.0) {
    const q = smooth((f - 0.85) / 0.15);
    out.q = q;
    out.r = 0;
    out.d = 1 - q;
  } else {
    const l = f - 1;
    const a = smooth((l - 0.25) / 0.12);
    const b = smooth((l - 0.62) / 0.12);
    out.q = 1 - a;
    out.r = a * (1 - b);
    out.d = a * b;
  }
  return out;
}

export function lifecycleWeights(f: number): LifecycleWeights {
  return lifecycleWeightsInto(f, { q: 0, r: 0, d: 1 });
}

/** The step/pill that should be highlighted for progress `f` ("" outside the lifecycle range). */
export function lifecycleKey(f: number): LifecycleKey {
  if (f < 0.95 || f > 2.1) return "";
  const w = lifecycleWeights(f);
  if (w.q >= w.r && w.q >= w.d) return "queued";
  return w.r >= w.d ? "running" : "done";
}

type NumericKeys = Exclude<keyof Keyframe, "f">;
const NUMERIC_KEYS: readonly NumericKeys[] = [
  "x",
  "y",
  "s",
  "rotX",
  "opacity",
  "xN",
  "yN",
  "sN",
  "opacityN",
];

/** Writes the interpolated keyframe for `f` into `out` (no allocation). */
export function sampleKeyframes(kfs: readonly Keyframe[], f: number, out: Keyframe): Keyframe {
  const first = kfs[0];
  const last = kfs[kfs.length - 1];
  if (f <= first.f) return Object.assign(out, first);
  if (f >= last.f) return Object.assign(out, last);
  let i = 0;
  while (f > kfs[i + 1].f) i++;
  const a = kfs[i];
  const b = kfs[i + 1];
  const t = smooth((f - a.f) / (b.f - a.f));
  out.f = f;
  for (const k of NUMERIC_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

/**
 * Progress `f`: index of the section holding the viewport center, plus the fraction scrolled
 * through it. `tops` are document offsets, `heights` the section heights.
 */
export function computeProgress(
  scrollY: number,
  viewportHeight: number,
  tops: readonly number[],
  heights: readonly number[],
): number {
  if (tops.length === 0) return 0;
  const center = scrollY + viewportHeight * 0.5;
  if (center < tops[0]) return 0;
  let i = 0;
  for (let k = 0; k < tops.length; k++) if (center >= tops[k]) i = k;
  const h = heights[i] || 1;
  return i + clamp((center - tops[i]) / h, 0, 1);
}

/** Deterministic PRNG so the dot field and beacon layout are the same on every load. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
