import { describe, expect, it } from "vitest";

import { KEYFRAMES, type Keyframe } from "./scene-config";
import {
  computeProgress,
  lifecycleKey,
  lifecycleWeights,
  mulberry32,
  sampleKeyframes,
} from "./scroll-progress";

const blank = (): Keyframe => ({ ...KEYFRAMES[0] });

describe("lifecycleWeights", () => {
  it("looks DONE outside the How it works range", () => {
    expect(lifecycleWeights(0.5)).toEqual({ q: 0, r: 0, d: 1 });
    expect(lifecycleWeights(2.4)).toEqual({ q: 0, r: 0, d: 1 });
  });

  it("goes QUEUED -> RUNNING -> DONE while scrolling through the section", () => {
    expect(lifecycleWeights(1.0).q).toBe(1);
    const running = lifecycleWeights(1.5);
    expect(running.r).toBeGreaterThan(0.9);
    expect(lifecycleWeights(1.95).d).toBeGreaterThan(0.9);
  });

  it("keeps the weights summing to 1", () => {
    for (let f = 0.8; f <= 2.1; f += 0.05) {
      const w = lifecycleWeights(f);
      expect(w.q + w.r + w.d).toBeCloseTo(1, 5);
    }
  });
});

describe("lifecycleKey", () => {
  it("returns the active step key and an empty key outside the range", () => {
    expect(lifecycleKey(0.2)).toBe("");
    expect(lifecycleKey(1.05)).toBe("queued");
    expect(lifecycleKey(1.5)).toBe("running");
    expect(lifecycleKey(1.9)).toBe("done");
    expect(lifecycleKey(2.5)).toBe("");
  });
});

describe("sampleKeyframes", () => {
  it("clamps before the first and after the last keyframe", () => {
    expect(sampleKeyframes(KEYFRAMES, 0, blank()).x).toBe(KEYFRAMES[0].x);
    expect(sampleKeyframes(KEYFRAMES, 9, blank()).y).toBe(KEYFRAMES[4].y);
  });

  it("interpolates between neighbouring keyframes", () => {
    const mid = sampleKeyframes(KEYFRAMES, 2.0, blank());
    expect(mid.y).toBeLessThan(KEYFRAMES[1].y);
    expect(mid.y).toBeGreaterThan(KEYFRAMES[2].y);
    expect(mid.f).toBe(2.0);
  });

  it("holds the horizon pose from the result section to the end", () => {
    const a = sampleKeyframes(KEYFRAMES, 2.5, blank());
    const b = sampleKeyframes(KEYFRAMES, 3.2, blank());
    const c = sampleKeyframes(KEYFRAMES, 4.5, blank());
    for (const k of ["x", "y", "s", "rotX", "opacity"] as const) {
      expect(b[k]).toBeCloseTo(a[k], 6);
      expect(c[k]).toBeCloseTo(a[k], 6);
    }
  });
});

describe("computeProgress", () => {
  const tops = [0, 800, 1900, 2800, 3700];
  const heights = [800, 1100, 900, 900, 600];

  it("is 0 above the first section", () => {
    expect(computeProgress(-1000, 800, tops, heights)).toBe(0);
  });

  it("measures at the viewport center as section index plus fraction", () => {
    expect(computeProgress(0, 800, tops, heights)).toBeCloseTo(0.5, 5);
    expect(computeProgress(800 - 400 + 550, 800, tops, heights)).toBeCloseTo(1.5, 5);
  });

  it("handles an empty measurement", () => {
    expect(computeProgress(100, 800, [], [])).toBe(0);
  });
});

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(20260);
    const b = mulberry32(20260);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
