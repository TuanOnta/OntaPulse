import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./use-now";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("useNow", () => {
  it("returns the current time and refreshes it on the interval", () => {
    const { result } = renderHook(() => useNow(60_000));
    const first = result.current;
    expect(first).toBe(Date.parse("2026-10-08T12:00:00Z"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(first + 60_000);
  });

  it("stops refreshing on unmount", () => {
    const clear = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
