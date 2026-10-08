import { useSyncExternalStore } from "react";

import type { LifecycleKey } from "./scroll-progress";

type Listener = () => void;

/**
 * Tiny external store holding the active "How it works" step. It changes at most a few times per
 * scroll pass, so React only re-renders the step cards and pills when the key actually changes.
 */
export function createLifecycleStore() {
  let key: LifecycleKey = "";
  const listeners = new Set<Listener>();
  return {
    get: (): LifecycleKey => key,
    set(next: LifecycleKey) {
      if (next === key) return;
      key = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LifecycleStore = ReturnType<typeof createLifecycleStore>;

export const lifecycleStore: LifecycleStore = createLifecycleStore();

export function useLifecycleKey(store: LifecycleStore = lifecycleStore): LifecycleKey {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
