import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type {
  Finding,
  Monitor,
  Project,
  ScanDetail,
  Workspace,
  WorkspaceRole,
} from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  projects: vi.fn(),
  monitors: vi.fn(),
  scan: vi.fn(),
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
      scan: mocks.scan,
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

import { ScanPage } from "./scan-page";

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

const created = new Date(Date.now() - 5 * 60_000);
const at = (ms: number) => new Date(created.getTime() + ms).toISOString();

function makeScan(extra: Partial<ScanDetail> = {}): ScanDetail {
  return {
    id: "scn-1",
    monitorId: "m1",
    status: "SUCCEEDED",
    statusCode: 200,
    responseTimeMs: 214,
    createdAt: at(0),
    startedAt: at(1900),
    finishedAt: at(2114),
    findings: [],
    ...extra,
  };
}
const finding = (code: string, severity: Finding["severity"]): Finding => ({
  id: code,
  scanId: "scn-1",
  code,
  title: "API title",
  severity,
  description: "API description",
  createdAt: at(2114),
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderNested() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/w1/projects/p1/monitors/m1/scans/scn-1"]}>
      <Routes>
        <Route
          element={<ScanPage />}
          path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId"
        />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}
function renderDirect() {
  return render(
    <MemoryRouter initialEntries={["/scans/scn-1"]}>
      <Routes>
        <Route element={<ScanPage />} path="/scans/:scanId" />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}
const main = () => within(screen.getByRole("main"));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.workspaces.mockResolvedValue([workspace("OWNER")]);
  mocks.projects.mockResolvedValue([project]);
  mocks.monitors.mockResolvedValue([monitor]);
  mocks.scan.mockResolvedValue(makeScan());
});

describe("ScanPage (nested route)", () => {
  it("shows a clean result: hero, tiles, lifecycle, request and the no-findings panel", async () => {
    renderNested();
    expect(
      await main().findByRole("heading", { level: 1, name: "Target responded normally" }),
    ).toBeVisible();
    expect(main().getByText("HTTP 200 in 214 ms, no findings.")).toBeVisible();
    expect(main().getAllByText("api.example.com").length).toBeGreaterThan(1);
    expect(main().getByRole("link", { name: "Core API" })).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1",
    );
    expect(main().getByText("OK")).toBeVisible();
    expect(main().getByText("Under the 2,000 ms slow threshold")).toBeVisible();
    expect(main().getByText("Nothing to report")).toBeVisible();

    const lifecycle = main().getByRole("list");
    expect(within(lifecycle).getAllByRole("listitem")).toHaveLength(3);
    expect(within(lifecycle).getByText("Succeeded")).toBeVisible();
    expect(main().getByText("https://api.example.com/v1/health")).toBeVisible();
    expect(main().getByText("scn-1")).toBeVisible();
    expect(main().getByRole("heading", { name: "No findings" })).toBeVisible();
  });

  it("lists findings most severe first with the prototype copy and the code", async () => {
    mocks.scan.mockResolvedValue(
      makeScan({
        statusCode: 503,
        responseTimeMs: 2410,
        findings: [finding("SLOW_RESPONSE", "MEDIUM"), finding("HTTP_SERVER_ERROR", "HIGH")],
      }),
    );
    renderNested();
    expect(
      await main().findByRole("heading", { level: 1, name: "Target answered, with 2 findings" }),
    ).toBeVisible();
    const cards = main().getAllByRole("article");
    expect(within(cards[0]).getByRole("heading", { name: "Server error response" })).toBeVisible();
    expect(within(cards[0]).getByText("HTTP_SERVER_ERROR")).toBeVisible();
    expect(within(cards[1]).getByRole("heading", { name: "Slow response" })).toBeVisible();
    expect(main().getByText("Above the 2,000 ms slow threshold")).toBeVisible();
    expect(main().getByText("Service Unavailable")).toBeVisible();
    expect(main().getByText("1 high")).toBeVisible();
  });

  it("falls back to the API text for an unknown finding code", async () => {
    mocks.scan.mockResolvedValue(makeScan({ findings: [finding("NEW_RULE", "LOW")] }));
    renderNested();
    expect(await main().findByRole("heading", { name: "API title" })).toBeVisible();
    expect(main().getByText("API description")).toBeVisible();
  });

  it("explains a failed scan with its error message", async () => {
    mocks.scan.mockResolvedValue(
      makeScan({
        status: "FAILED",
        statusCode: null,
        responseTimeMs: null,
        errorMessage: "The target did not respond within 10 seconds.",
        finishedAt: at(12_100),
      }),
    );
    renderNested();
    expect(
      await main().findByRole("heading", { level: 1, name: "The check could not complete" }),
    ).toBeVisible();
    expect(
      main().getByRole("heading", { name: "The target did not respond within 10 seconds." }),
    ).toBeVisible();
    expect(main().getByText("No response")).toBeVisible();
    expect(main().getByText("Gave up after 10.2 s. Not retried.")).toBeVisible();
  });

  it("shows the waiting panel and disables Run scan again while the scan is running", async () => {
    mocks.scan.mockResolvedValue(
      makeScan({ status: "RUNNING", statusCode: null, responseTimeMs: null, finishedAt: null }),
    );
    renderNested();
    expect(
      await main().findByRole("heading", { level: 1, name: "Checking the target…" }),
    ).toBeVisible();
    expect(main().getByText("Findings will appear here")).toBeVisible();
    expect(main().getByRole("button", { name: "Run scan again" })).toBeDisabled();
    expect(main().getByText("Not finished yet")).toBeVisible();
  });

  it("runs the scan again and opens the new scan", async () => {
    const user = userEvent.setup();
    mocks.triggerScan.mockResolvedValue(makeScan({ id: "scn-2", status: "QUEUED" }));
    renderNested();
    await user.click(await main().findByRole("button", { name: "Run scan again" }));
    expect(mocks.triggerScan).toHaveBeenCalledWith("m1");
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/workspaces/w1/projects/p1/monitors/m1/scans/scn-2",
      ),
    );
  });

  it("shows a view-only note for a MEMBER", async () => {
    mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
    renderNested();
    expect(await main().findByText("View-only access.")).toBeVisible();
    expect(main().queryByRole("button", { name: "Run scan again" })).not.toBeInTheDocument();
  });

  it("copies the scan id", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderNested();
    await user.click(await main().findByRole("button", { name: "Copy scan ID" }));
    expect(writeText).toHaveBeenCalledWith("scn-1");
  });

  it("shows not found when the scan belongs to another monitor, or the context is missing", async () => {
    mocks.scan.mockResolvedValue(makeScan({ monitorId: "other" }));
    const first = renderNested();
    expect(await main().findByText("Scan not found")).toBeVisible();
    expect(main().getByRole("link", { name: "Back to monitor" })).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/monitors/m1",
    );
    first.unmount();

    mocks.scan.mockRejectedValue(new ApiError({ statusCode: 404, code: "NF", message: "nf" }));
    const second = renderNested();
    expect(await main().findByText("Scan not found")).toBeVisible();
    second.unmount();

    mocks.scan.mockResolvedValue(makeScan());
    mocks.monitors.mockResolvedValue([]);
    renderNested();
    expect(await main().findByRole("link", { name: "Back to project" })).toBeVisible();
  });

  it("shows the error banner with the request id and retries", async () => {
    const user = userEvent.setup();
    mocks.scan.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-3" }),
    );
    renderNested();
    expect(await main().findByText("Couldn’t load this scan.")).toBeVisible();
    expect(main().getByText(/req-3/)).toBeVisible();
    await user.click(main().getByRole("button", { name: "Try again" }));
    expect(
      await main().findByRole("heading", { level: 1, name: "Target responded normally" }),
    ).toBeVisible();
  });
});

describe("ScanPage (direct route)", () => {
  it("degrades to what is known: no host, no target, no run again", async () => {
    renderDirect();
    expect(
      await main().findByRole("heading", { level: 1, name: "Target responded normally" }),
    ).toBeVisible();
    expect(main().getByText("Not available")).toBeVisible();
    expect(main().queryByRole("button", { name: "Run scan again" })).not.toBeInTheDocument();
    expect(main().queryByText("View-only access.")).not.toBeInTheDocument();
    expect(mocks.projects).not.toHaveBeenCalled();
    expect(mocks.monitors).not.toHaveBeenCalled();
    const crumbs = main().getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getAllByRole("link")).toHaveLength(1);
  });

  it("sends a missing scan back to the dashboard", async () => {
    mocks.scan.mockRejectedValue(new ApiError({ statusCode: 404, code: "NF", message: "nf" }));
    renderDirect();
    expect(await main().findByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
