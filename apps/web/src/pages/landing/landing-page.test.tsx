import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lifecycleStore } from "@/widgets/landing-scene/model/lifecycle-store";

import { LandingPage } from "./landing-page";

function stubBrowserApis() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  beforeEach(stubBrowserApis);
  afterEach(() => {
    vi.unstubAllGlobals();
    lifecycleStore.set("");
  });

  it("renders exactly the five sections in order and no footer", () => {
    const { container } = renderLanding();
    const ids = Array.from(container.querySelectorAll("main > section")).map((el) => el.id);
    expect(ids).toEqual(["hero", "how", "result", "features", "cta"]);
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Know the moment your site breaks.",
    );
  });

  it("routes the auth CTAs and keeps in-page anchors", () => {
    renderLanding();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(within(nav).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how");
    expect(screen.getByRole("link", { name: "Start monitoring" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "#how");
    expect(screen.getByRole("link", { name: "Create your workspace" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("keeps the decorative scene out of the accessibility tree and shows the fallback first", () => {
    renderLanding();
    expect(screen.getByTestId("scene-fallback")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("scene-fallback")).toHaveClass("opacity-100");
  });

  it("highlights the active lifecycle step and pill from the store", async () => {
    const { container } = renderLanding();
    expect(container.querySelector('[data-active="true"]')).toBeNull();
    lifecycleStore.set("running");
    await vi.waitFor(() => {
      expect(container.querySelector('[data-step="running"]')).toHaveAttribute(
        "data-active",
        "true",
      );
    });
    expect(container.querySelector('[data-pill="running"]')).toHaveAttribute("data-active", "true");
    expect(container.querySelector('[data-step="queued"]')).toHaveAttribute("data-active", "false");
  });

  it("labels the sample scan card as static content with its findings", () => {
    renderLanding();
    const sample = screen.getByRole("group", { name: "Sample scan result" });
    expect(within(sample).getByText("HTTP_SERVER_ERROR")).toBeInTheDocument();
    expect(within(sample).getByText("SLOW_RESPONSE")).toBeInTheDocument();
  });
});
