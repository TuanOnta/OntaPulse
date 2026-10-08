import { useEffect } from "react";

import { lifecycleStore, type LifecycleStore } from "./lifecycle-store";
import { progressBus, type ProgressBus } from "./progress-bus";
import { SECTION_IDS } from "./scene-config";
import { computeProgress, lifecycleKey } from "./scroll-progress";

type Targets = { progress?: ProgressBus; lifecycle?: LifecycleStore };

/**
 * Measures the five landing sections and publishes the scroll progress `f` (to the scene, through
 * the progress bus) and the active lifecycle step (to the step cards and pills, through the
 * lifecycle store). Scroll events are coalesced to one update per animation frame.
 */
export function useLandingScroll({
  progress = progressBus,
  lifecycle = lifecycleStore,
}: Targets = {}): void {
  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id));
    if (sections.some((el) => el === null)) return;

    let tops: number[] = [];
    let heights: number[] = [];
    let frame = 0;

    function measure(): void {
      tops = sections.map((el) => el!.getBoundingClientRect().top + window.scrollY);
      heights = sections.map((el) => el!.offsetHeight);
    }
    function update(): void {
      frame = 0;
      const f = computeProgress(window.scrollY, window.innerHeight, tops, heights);
      lifecycle.set(lifecycleKey(f));
      progress.set(f);
    }
    function schedule(): void {
      if (!frame) frame = requestAnimationFrame(update);
    }
    function remeasure(): void {
      measure();
      schedule();
    }

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    void document.fonts?.ready.then(remeasure);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
      lifecycle.set("");
      progress.set(0.5);
    };
  }, [progress, lifecycle]);
}
