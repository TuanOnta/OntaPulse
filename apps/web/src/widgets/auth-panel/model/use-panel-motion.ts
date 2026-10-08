import { useCallback, useEffect, useRef, type PointerEvent } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** One shake of the card (CSS `auth-shake` in the prototype): offsets are px, 0 at both ends. */
export const SHAKE_FRAMES: readonly Keyframe[] = [
  { offset: 0, transform: "translateX(0)" },
  { offset: 0.1, transform: "translateX(-2px)" },
  { offset: 0.2, transform: "translateX(4px)" },
  { offset: 0.3, transform: "translateX(-7px)" },
  { offset: 0.4, transform: "translateX(7px)" },
  { offset: 0.5, transform: "translateX(-7px)" },
  { offset: 0.6, transform: "translateX(7px)" },
  { offset: 0.7, transform: "translateX(-7px)" },
  { offset: 0.8, transform: "translateX(4px)" },
  { offset: 0.9, transform: "translateX(-2px)" },
  { offset: 1, transform: "translateX(0)" },
];
export const SHAKE_DURATION_MS = 450;
export const SHAKE_EASING = "cubic-bezier(.36,.07,.19,.97)";

function motionAllowed(): boolean {
  return typeof window.matchMedia !== "function" || !window.matchMedia(REDUCED_QUERY).matches;
}

/**
 * Card motion that needs script: a restartable shake and the pointer spotlight. The spotlight sets
 * two CSS variables straight on the element (no React state per pointer move).
 */
export function usePanelMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const shakeAnimation = useRef<Animation | null>(null);

  useEffect(() => () => shakeAnimation.current?.cancel(), []);

  const shake = useCallback(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || !motionAllowed()) return;
    shakeAnimation.current?.cancel();
    shakeAnimation.current = el.animate(SHAKE_FRAMES as Keyframe[], {
      duration: SHAKE_DURATION_MS,
      easing: SHAKE_EASING,
    });
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, []);

  return { ref, shake, onPointerMove };
}
