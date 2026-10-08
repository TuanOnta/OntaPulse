import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createLifecycleStore, useLifecycleKey } from "./lifecycle-store";

describe("lifecycle store", () => {
  it("notifies subscribers only when the key changes", () => {
    const store = createLifecycleStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set("queued");
    store.set("queued");
    store.set("running");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set("done");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe("done");
  });

  it("drives React consumers", () => {
    const store = createLifecycleStore();
    const { result } = renderHook(() => useLifecycleKey(store));
    expect(result.current).toBe("");
    act(() => store.set("running"));
    expect(result.current).toBe("running");
  });
});
