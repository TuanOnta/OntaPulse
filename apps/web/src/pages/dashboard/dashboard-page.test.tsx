import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type { Workspace } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({ workspaces: vi.fn(), logout: vi.fn() }));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { ...original.api, workspaces: mocks.workspaces } };
});
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Dzaki Arta", email: "dzaki@example.com" },
    isLoading: false,
    logout: mocks.logout,
  }),
}));

import { DashboardPage } from "./dashboard-page";

const make = (id: string, name: string, role: Workspace["role"]): Workspace => ({
  id,
  name,
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});

const LIST = [
  make("w1", "MrScraper Platform", "OWNER"),
  make("w2", "Personal projects", "OWNER"),
  make("w3", "Client — Glam by Qody", "ADMIN"),
  make("w4", "Open-source status pages", "MEMBER"),
];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route element={<p>Landing</p>} path="/" />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const main = () => within(screen.getByRole("main"));

beforeEach(() => {
  mocks.workspaces.mockReset();
  mocks.logout.mockReset();
  // Reduced motion: the stats show their final numbers straight away.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("DashboardPage", () => {
  it("shows loading placeholders while the workspaces load", () => {
    mocks.workspaces.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(main().getByRole("status", { name: "Loading workspaces" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("greets the user and lists workspaces with role, date, stats and sidebar links", async () => {
    mocks.workspaces.mockResolvedValue(LIST);
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Welcome back, Dzaki" })).toBeVisible();
    expect(mocks.workspaces).toHaveBeenCalledTimes(1);
    const card = main().getByRole("link", { name: "Open workspace MrScraper Platform" });
    expect(card).toHaveAttribute("href", "/workspaces/w1");
    expect(main().getAllByRole("article")).toHaveLength(5); // 4 workspaces + the create card
    expect(main().getByRole("link", { name: "Create a new workspace" })).toHaveAttribute(
      "href",
      "/workspaces/new",
    );

    expect(main().getByLabelText("Workspaces: 4")).toBeInTheDocument();
    expect(main().getByLabelText("You own: 2")).toBeInTheDocument();
    expect(main().getByLabelText("Shared with you: 2")).toBeInTheDocument();

    const sidebar = within(screen.getByRole("navigation", { name: "Workspaces" }));
    expect(sidebar.getByRole("link", { name: "Personal projects" })).toHaveAttribute(
      "href",
      "/workspaces/w2",
    );
    expect(screen.getByText("dzaki@example.com")).toBeInTheDocument();
  });

  it("shows each card's role as text, its age next to the date, and a stable tone", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T12:00:00Z") });
    try {
      mocks.workspaces.mockResolvedValue(LIST);
      renderDashboard();
      await screen.findByRole("heading", { name: "Welcome back, Dzaki" });

      const cards = main().getAllByRole("article");
      const first = within(cards[0]);
      expect(first.getByText("OWNER")).toBeInTheDocument();
      expect(first.getByText("(owner)")).toBeInTheDocument();
      expect(first.getByText(/^Created /)).toBeInTheDocument();
      expect(first.getByText("7 mo ago")).toBeInTheDocument(); // 2026-03-04 -> 2026-10-08
      expect(within(cards[3]).getByText("7 mo ago")).toBeInTheDocument();
      expect(within(cards[2]).getByText("(admin)")).toBeInTheDocument();

      const toneOf = (el: HTMLElement) =>
        /\[--t:var\(--color-landing-(\w+)\)\]/.exec(el.className)?.[1];
      const tones = cards.slice(0, 4).map((card) => toneOf(card));
      expect(tones.every(Boolean)).toBe(true);
      expect(new Set(tones).size).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters by role and hides the create card while a filter is active", async () => {
    const user = userEvent.setup();
    mocks.workspaces.mockResolvedValue(LIST);
    renderDashboard();
    await screen.findByRole("heading", { name: "Welcome back, Dzaki" });

    const admin = main().getByRole("button", { name: /Admin/ });
    expect(admin).toHaveAttribute("aria-pressed", "false");
    await user.click(admin);

    expect(admin).toHaveAttribute("aria-pressed", "true");
    expect(main().getAllByRole("article")).toHaveLength(1);
    expect(main().queryByRole("link", { name: "Create a new workspace" })).not.toBeInTheDocument();
  });

  it("explains an empty search and clears the filters", async () => {
    const user = userEvent.setup();
    mocks.workspaces.mockResolvedValue(LIST);
    renderDashboard();
    await screen.findByRole("heading", { name: "Welcome back, Dzaki" });

    await user.type(main().getByRole("searchbox", { name: "Search workspaces" }), "zzz");
    expect(main().getByRole("heading", { name: "No matching workspaces" })).toBeVisible();
    expect(main().getByText(/Nothing matches “zzz”/)).toBeInTheDocument();

    await user.click(main().getByRole("button", { name: "Clear filters" }));
    expect(main().getAllByRole("article")).toHaveLength(5);
    expect(main().getByRole("searchbox", { name: "Search workspaces" })).toHaveValue("");
  });

  it("invites the user to create a first workspace when there are none", async () => {
    mocks.workspaces.mockResolvedValue([]);
    renderDashboard();
    expect(
      await main().findByRole("heading", { name: "Create your first workspace" }),
    ).toBeVisible();
    expect(main().getByRole("link", { name: "Create workspace" })).toHaveAttribute(
      "href",
      "/workspaces/new",
    );
    expect(main().queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByText("No workspaces yet.")).toBeInTheDocument();
  });

  it("shows the error banner with the request id and retries", async () => {
    const user = userEvent.setup();
    mocks.workspaces
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 500,
          code: "INTERNAL",
          message: "The service is unavailable.",
          requestId: "req-9c21",
        }),
      )
      .mockResolvedValue(LIST);
    renderDashboard();

    const alert = await main().findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load your workspaces.");
    expect(alert).toHaveTextContent("The service is unavailable.");
    expect(alert).toHaveTextContent("Request ID: req-9c21");
    expect(screen.getByText("Unavailable.")).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await main().findByLabelText("Workspaces: 4")).toBeInTheDocument();
    expect(main().queryByRole("alert")).not.toBeInTheDocument();
    // One shared request: the sidebar recovers together with the page.
    expect(screen.queryByText("Unavailable.")).not.toBeInTheDocument();
    expect(mocks.workspaces).toHaveBeenCalledTimes(2);
  });

  it("signs out and returns to the landing page", async () => {
    const user = userEvent.setup();
    mocks.workspaces.mockResolvedValue(LIST);
    mocks.logout.mockResolvedValue(undefined);
    renderDashboard();
    await screen.findByRole("heading", { name: "Welcome back, Dzaki" });

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/"));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
});
