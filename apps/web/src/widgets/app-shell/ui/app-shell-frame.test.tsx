import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShellFrame } from "./app-shell-frame";

function renderFrame(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShellFrame
        onSignOut={vi.fn()}
        user={{ name: "Dzaki Arta", email: "dzaki@example.com" }}
        workspaces={{
          status: "ready",
          workspaces: [
            {
              id: "w1",
              name: "MrScraper Platform",
              role: "OWNER",
              createdAt: "2026-03-04T08:12:00Z",
              updatedAt: "2026-03-04T08:12:00Z",
            },
          ],
        }}
      >
        <h1>Page</h1>
      </AppShellFrame>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("AppShellFrame", () => {
  it("marks the current page and offers a skip link to the content", () => {
    renderFrame("/dashboard");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New workspace" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#content",
    );
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Page" }),
    );
  });

  it("highlights the open workspace while on one of its pages", () => {
    renderFrame("/workspaces/w1/projects/p1");
    expect(screen.getByRole("link", { name: "MrScraper Platform" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the drawer, focuses it, and closes with Escape returning focus to the menu button", async () => {
    const user = userEvent.setup();
    renderFrame();
    const menu = screen.getByRole("button", { name: "Open navigation" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-controls", "app-sidebar");

    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await vi.waitFor(() =>
      expect(document.getElementById("app-sidebar")).toContainElement(
        document.activeElement as HTMLElement,
      ),
    );

    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("closes the drawer when the scrim is clicked", async () => {
    const user = userEvent.setup();
    renderFrame();
    const menu = screen.getByRole("button", { name: "Open navigation" });
    await user.click(menu);
    await user.click(screen.getByTestId("drawer-scrim"));
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
