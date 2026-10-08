import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetTilt, trackSpotlight } from "./pointer-spotlight";

function fakeEvent(clientX: number, clientY: number) {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 200, height: 100 }) as unknown as DOMRect;
  return {
    el,
    event: { currentTarget: el, clientX, clientY } as unknown as PointerEvent<HTMLElement>,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("trackSpotlight", () => {
  it("writes the pointer position and a tilt toward the pointer", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { el, event } = fakeEvent(300, 50); // top-right corner of the card
    trackSpotlight(event);
    expect(el.style.getPropertyValue("--mx")).toBe("200px");
    expect(el.style.getPropertyValue("--my")).toBe("0px");
    expect(el.style.getPropertyValue("--ry")).toBe("3.00deg");
    expect(el.style.getPropertyValue("--rx")).toBe("2.50deg");
  });

  it("is level at the centre", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { el, event } = fakeEvent(200, 100);
    trackSpotlight(event);
    expect(el.style.getPropertyValue("--ry")).toBe("0.00deg");
    expect(el.style.getPropertyValue("--rx")).toBe("0.00deg");
  });

  it("does nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { el, event } = fakeEvent(300, 50);
    trackSpotlight(event);
    expect(el.style.getPropertyValue("--ry")).toBe("");
  });
});

describe("resetTilt", () => {
  it("levels the card", () => {
    const { el, event } = fakeEvent(0, 0);
    el.style.setProperty("--rx", "4deg");
    el.style.setProperty("--ry", "-3deg");
    resetTilt(event);
    expect(el.style.getPropertyValue("--rx")).toBe("0deg");
    expect(el.style.getPropertyValue("--ry")).toBe("0deg");
  });
});
