type ProgressListener = (f: number) => void;

/** Carries the scroll progress `f` from the scroll hook to the scene without React state. */
export function createProgressBus(initial = 0.5) {
  let value = initial;
  const listeners = new Set<ProgressListener>();
  return {
    get: (): number => value,
    set(next: number) {
      if (next === value) return;
      value = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener: ProgressListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ProgressBus = ReturnType<typeof createProgressBus>;

export const progressBus: ProgressBus = createProgressBus();
