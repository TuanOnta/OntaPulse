import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "./use-count-up";

function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCountUp", () => {
  it("shows the target straight away under reduced motion", () => {
    stubMotion(true);
    const { result } = renderHook(() => useCountUp(12));
    expect(result.current).toBe(12);
  });

  it("does not animate zero", () => {
    stubMotion(false);
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe(0);
  });

  it("counts up and ends exactly on the target", () => {
    stubMotion(false);
    const { result } = renderHook(() => useCountUp(10, 100));
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThanOrEqual(10);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(10);
  });
});
