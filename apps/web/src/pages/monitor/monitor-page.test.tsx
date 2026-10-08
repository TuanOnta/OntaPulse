import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type { Monitor, Project, Scan, Workspace, WorkspaceRole } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  projects: vi.fn(),
  monitors: vi.fn(),
  scans: vi.fn(),
  triggerScan: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return {
    ...original,
    api: {
      ...original.api,
      workspaces: mocks.workspaces,
      projects: mocks.projects,
      monitors: mocks.monitors,
      scans: mocks.scans,
      triggerScan: mocks.triggerScan,
    },
  };
});
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Dzaki Arta", email: "dzaki@example.com" },
    isLoading: false,
    logout: mocks.logout,
  }),
}));

import { MonitorPage } from "./monitor-page";

const workspace = (role: WorkspaceRole): Workspace => ({
  id: "w1",
  name: "MrScraper Platform",
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});
const project: Project = {
  id: "p1",
  workspaceId: "w1",
  name: "Core API",
  description: null,
  createdAt: "2026-03-18T14:20:00Z",
  updatedAt: "2026-03-18T14:20:00Z",
};
const monitor: Monitor = {
  id: "m1",
  projectId: "p1",
  name: "api.example.com",
  targetUrl: "https://api.example.com/v1/health",
  intervalSeconds: 300,
  isActive: true,
  createdAt: "2026-03-18T14:40:00Z",
  updatedAt: "2026-03-18T14:40:00Z",
};

function makeScan(id: string, status: Scan["status"], extra: Partial<Scan> = {}): Scan {
  return {
    id,
    monitorId: "m1",
    status,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...extra,
  };
}

const HISTORY: Scan[] = [
  makeScan("s1", "SUCCEEDED", { statusCode: 200, responseTimeMs: 214 }),
  makeScan("s2", "SUCCEEDED", { statusCode: 503, responseTimeMs: 2410 }),
  makeScan("s3", "FAILED", { errorMessage: "timeout" }),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/w1/projects/p1/monitors/m1"]}>
      <Routes>
        <Route
          element={<MonitorPage />}
          path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId"
        />
      </Routes>
    </MemoryRouter>,
  );
}
const main = () => within(screen.getByRole("main"));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.workspaces.mockResolvedValue([workspace("OWNER")]);
  mocks.projects.mockResolvedValue([project]);
  mocks.monitors.mockResolvedValue([monitor]);
  mocks.scans.mockResolvedValue(HISTORY);
});

describe("MonitorPage", () => {
  it("shows the breadcrumb, header, tiles, chart and the scan history", async () => {
    renderPage();
    expect(
      await main().findByRole("heading", { level: 1, name: /api\.example\.com/ }),
    ).toBeVisible();
    expect(main().getByText("HTTPS")).toBeVisible();
    expect(main().getByText("/v1/health")).toBeVisible();
    expect(main().getByRole("link", { name: "Core API" })).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1",
    );
    expect(main().getByText("https://api.example.com/v1/health")).toBeVisible();
    expect(main().getByText("Every 5 min")).toBeVisible();
    expect(main().getByText("300 seconds")).toBeVisible();
    expect(main().getByText("HTTP GET")).toBeVisible();
    expect(main().getByText("in Core API")).toBeVisible();

    expect(await main().findByText("Last 3 finished scans, oldest to newest")).toBeVisible();
    expect(main().getAllByRole("img").length).toBe(3);
    expect(main().getByRole("img", { name: /2410 milliseconds .*slow/ })).toBeVisible();
    expect(main().getByRole("img", { name: /Failed scan at/ })).toBeVisible();

    const table = main().getByRole("table", { name: "Scan history" });
    expect(within(table).getByText("214 ms")).toBeVisible();
    expect(within(table).getByText("2,410 ms")).toBeVisible();
    expect(within(table).getByText("503")).toBeVisible();
    expect(within(table).getByText("no response")).toBeVisible();
    expect(main().getAllByRole("link", { name: /^Open scan from/ })[0]).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/monitors/m1/scans/s1",
    );
  });

  it("filters the history with counts", async () => {
    const user = userEvent.setup();
    renderPage();
    await main().findByRole("table", { name: "Scan history" });
    expect(main().getByRole("button", { name: /^All\s*3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(main().getByRole("button", { name: /^Failed\s*1/ }));
    const table = main().getByRole("table", { name: "Scan history" });
    expect(within(table).getAllByRole("link")).toHaveLength(1);
    expect(within(table).queryByText("214 ms")).not.toBeInTheDocument();
  });

  it("runs a scan: the new scan appears on top and the button is busy until it finishes", async () => {
    const user = userEvent.setup();
    mocks.triggerScan.mockResolvedValue(makeScan("s9", "QUEUED"));
    renderPage();
    await user.click(await main().findByRole("button", { name: "Run scan" }));
    expect(mocks.triggerScan).toHaveBeenCalledWith("m1");
    const table = await main().findByRole("table", { name: "Scan history" });
    await waitFor(() => expect(within(table).getAllByRole("link")).toHaveLength(4));
    expect(within(table).getAllByRole("link")[0]).toHaveAccessibleName(/queued/);
    expect(within(table).getByText("pending")).toBeVisible();
    expect(main().getByRole("button", { name: "Scanning…" })).toBeDisabled();
  });

  it("copies the target URL, and says so when the clipboard refuses", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await user.click(await main().findByRole("button", { name: "Copy target URL" }));
    expect(writeText).toHaveBeenCalledWith("https://api.example.com/v1/health");

    writeText.mockRejectedValue(new Error("denied"));
    await user.click(main().getByRole("button", { name: "Copy target URL" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it("hides Run scan for a MEMBER", async () => {
    mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
    renderPage();
    expect(await main().findByText(/View-only access/)).toBeVisible();
    expect(main().queryByRole("button", { name: "Run scan" })).not.toBeInTheDocument();
  });

  it("shows the empty state with a Run scan action for managers", async () => {
    mocks.scans.mockResolvedValue([]);
    renderPage();
    expect(await main().findByText("No scans yet")).toBeVisible();
    expect(main().getAllByRole("button", { name: "Run scan" })).toHaveLength(2);
    expect(main().queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows not found when the monitor, the project or the workspace is missing", async () => {
    mocks.monitors.mockResolvedValue([]);
    const first = renderPage();
    expect(await main().findByText("Monitor not found")).toBeVisible();
    expect(main().getByRole("link", { name: "Back to project" })).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1",
    );
    first.unmount();

    mocks.monitors.mockResolvedValue([monitor]);
    mocks.projects.mockResolvedValue([]);
    const second = renderPage();
    expect(await main().findByText("Monitor not found")).toBeVisible();
    expect(main().getByRole("link", { name: "Back to workspace" })).toBeVisible();
    second.unmount();

    mocks.projects.mockResolvedValue([project]);
    mocks.workspaces.mockResolvedValue([]);
    renderPage();
    expect(await main().findByRole("link", { name: "Back to dashboard" })).toBeVisible();
  });

  it("shows the error banner with the request id and retries", async () => {
    const user = userEvent.setup();
    mocks.monitors.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-5" }),
    );
    renderPage();
    expect(await main().findByText("Couldn’t load this monitor.")).toBeVisible();
    expect(main().getByText(/req-5/)).toBeVisible();
    await user.click(main().getByRole("button", { name: "Try again" }));
    expect(
      await main().findByRole("heading", { level: 1, name: /api\.example\.com/ }),
    ).toBeVisible();
  });

  it("offers a retry when only the scan history fails", async () => {
    const user = userEvent.setup();
    mocks.scans.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderPage();
    expect(await main().findByText("Couldn’t load the scan history.")).toBeVisible();
    await user.click(main().getByRole("button", { name: "Try again" }));
    expect(await main().findByRole("table", { name: "Scan history" })).toBeVisible();
  });
});
