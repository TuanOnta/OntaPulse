import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type { Monitor, Project, Workspace, WorkspaceRole } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  projects: vi.fn(),
  monitors: vi.fn(),
  triggerScan: vi.fn(),
  scan: vi.fn(),
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
      triggerScan: mocks.triggerScan,
      scan: mocks.scan,
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

import { ProjectPage } from "./project-page";

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
  description: "REST endpoints used by the web client.",
  createdAt: "2026-03-18T14:20:00Z",
  updatedAt: "2026-03-18T14:20:00Z",
};
const monitor = (id: string, targetUrl: string, intervalSeconds: number): Monitor => ({
  id,
  projectId: "p1",
  name: "n",
  targetUrl,
  intervalSeconds,
  isActive: true,
  createdAt: "2026-03-18T14:40:00Z",
  updatedAt: "2026-03-18T14:40:00Z",
});
const MONITORS = [
  monitor("m1", "https://api.example.com/v1/health", 60),
  monitor("m2", "http://legacy.example.com/ping", 86_400),
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/w1/projects/p1"]}>
      <Routes>
        <Route element={<ProjectPage />} path="/workspaces/:workspaceId/projects/:projectId" />
        <Route element={<p>Workspace</p>} path="/workspaces/:workspaceId" />
      </Routes>
    </MemoryRouter>,
  );
}
const main = () => within(screen.getByRole("main"));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.workspaces.mockResolvedValue([workspace("OWNER")]);
  mocks.projects.mockResolvedValue([project]);
  mocks.monitors.mockResolvedValue(MONITORS);
});

describe("ProjectPage", () => {
  it("shows the header, the breadcrumb and one row per monitor", async () => {
    renderPage();
    expect(await main().findByRole("heading", { level: 1, name: "Core API" })).toBeVisible();
    expect(main().getByText("REST endpoints used by the web client.")).toBeVisible();
    expect(main().getByRole("link", { name: "MrScraper Platform" })).toHaveAttribute(
      "href",
      "/workspaces/w1",
    );
    expect(await main().findByText("2 monitors")).toBeVisible();
    expect(
      main().getByRole("link", { name: "Open monitor https://api.example.com/v1/health" }),
    ).toHaveAttribute("href", "/workspaces/w1/projects/p1/monitors/m1");
    expect(main().getByText("api.example.com")).toBeVisible();
    expect(main().getByText("HTTP")).toBeVisible();
    expect(main().getByText("every 1 min")).toBeVisible();
    expect(main().getByText("every day")).toBeVisible();
  });

  it("filters by search and offers to clear it", async () => {
    const user = userEvent.setup();
    renderPage();
    await main().findByText("2 monitors");
    await user.type(main().getByRole("searchbox", { name: "Search monitors" }), "legacy");
    expect(main().queryByText("api.example.com")).not.toBeInTheDocument();
    await user.clear(main().getByRole("searchbox", { name: "Search monitors" }));
    await user.type(main().getByRole("searchbox", { name: "Search monitors" }), "zzz");
    expect(main().getByText("No matching monitors")).toBeVisible();
    await user.click(main().getByRole("button", { name: "Clear search" }));
    expect(main().getByText("api.example.com")).toBeVisible();
  });

  it("runs a scan and follows it to a result", async () => {
    const user = userEvent.setup();
    mocks.triggerScan.mockResolvedValue({ id: "s1", status: "QUEUED" });
    mocks.scan.mockResolvedValue({ status: "SUCCEEDED", findings: [] });
    renderPage();
    await user.click(await main().findByRole("button", { name: "Run scan for api.example.com" }));
    expect(mocks.triggerScan).toHaveBeenCalledWith("m1");
    expect(await main().findByText("Queued")).toBeVisible();
    expect(await main().findByText("Succeeded · no findings", {}, { timeout: 4000 })).toBeVisible();
    expect(main().getByRole("button", { name: "Run scan for api.example.com" })).toBeEnabled();
  });

  it("hides add and run actions for a MEMBER", async () => {
    mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
    renderPage();
    expect(await main().findByText(/View-only access/)).toBeVisible();
    expect(main().queryByRole("button", { name: "Add monitor" })).not.toBeInTheDocument();
    expect(main().queryByRole("button", { name: /Run scan/ })).not.toBeInTheDocument();
  });

  it("shows the empty state for a project without monitors", async () => {
    mocks.monitors.mockResolvedValue([]);
    renderPage();
    expect(await main().findByText("No monitors yet")).toBeVisible();
    expect(main().getAllByRole("button", { name: "Add monitor" }).length).toBe(2);
  });

  it("shows not found for an unknown project and when the monitors request answers 404", async () => {
    mocks.projects.mockResolvedValue([]);
    const first = renderPage();
    expect(await main().findByText("Project not found")).toBeVisible();
    expect(main().getByRole("link", { name: "Back to workspace" })).toHaveAttribute(
      "href",
      "/workspaces/w1",
    );
    first.unmount();

    mocks.projects.mockResolvedValue([project]);
    mocks.monitors.mockRejectedValue(
      new ApiError({ statusCode: 404, code: "NOT_FOUND", message: "nf" }),
    );
    renderPage();
    expect(await main().findByText("Project not found")).toBeVisible();
  });

  it("shows the error banner with the request id and retries", async () => {
    const user = userEvent.setup();
    mocks.projects.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-9" }),
    );
    renderPage();
    expect(await main().findByText("Couldn’t load this project.")).toBeVisible();
    expect(main().getByText(/req-9/)).toBeVisible();
    await user.click(main().getByRole("button", { name: "Try again" }));
    expect(await main().findByRole("heading", { level: 1, name: "Core API" })).toBeVisible();
  });

  it("adds a monitor from the dialog and reloads the list", async () => {
    const user = userEvent.setup();
    const createMonitor = vi.fn().mockResolvedValue(monitor("m3", "https://new.io", 300));
    const { api } = await import("@/shared/api/client");
    Object.assign(api, { createMonitor });
    renderPage();
    await user.click((await main().findAllByRole("button", { name: "Add monitor" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Target URL"), "https://new.io");
    await user.click(within(dialog).getByRole("button", { name: "Add monitor" }));
    await waitFor(() => expect(createMonitor).toHaveBeenCalled());
    await waitFor(() => expect(mocks.monitors).toHaveBeenCalledTimes(2));
  });

  describe("rename and delete", () => {
    it("shows the menu to OWNER and ADMIN with Delete enabled, and hides it from MEMBER", async () => {
      const user = userEvent.setup();
      mocks.workspaces.mockResolvedValue([workspace("ADMIN")]);
      const admin = renderPage();
      (await main().findByRole("button", { name: "Project settings" })).focus();
      await user.keyboard("{Enter}");
      expect(await screen.findByRole("menuitem", { name: "Delete project" })).not.toHaveAttribute(
        "data-disabled",
      );
      admin.unmount();

      mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
      renderPage();
      await main().findByText(/View-only access/);
      expect(main().queryByRole("button", { name: "Project settings" })).not.toBeInTheDocument();
    });

    it("renames the project and its description", async () => {
      const user = userEvent.setup();
      const updateProject = vi
        .fn()
        .mockResolvedValue({ ...project, name: "Core API v2", description: "Updated text" });
      const { api } = await import("@/shared/api/client");
      Object.assign(api, { updateProject });
      renderPage();
      (await main().findByRole("button", { name: "Project settings" })).focus();
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("menuitem", { name: "Rename project" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByLabelText("Name")).toHaveValue("Core API");
      await user.clear(within(dialog).getByLabelText("Name"));
      await user.type(within(dialog).getByLabelText("Name"), "Core API v2");
      await user.clear(within(dialog).getByLabelText(/Description/));
      await user.type(within(dialog).getByLabelText(/Description/), "Updated text");
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        expect(updateProject).toHaveBeenCalledWith("p1", {
          name: "Core API v2",
          description: "Updated text",
        }),
      );
      expect(await main().findByRole("heading", { level: 1, name: "Core API v2" })).toBeVisible();
      expect(main().getByText("Updated text")).toBeVisible();
    });

    it("deletes after the name is typed and offers the way back to the workspace", async () => {
      const user = userEvent.setup();
      const deleteProject = vi.fn().mockResolvedValue(undefined);
      const { api } = await import("@/shared/api/client");
      Object.assign(api, { deleteProject });
      renderPage();
      (await main().findByRole("button", { name: "Project settings" })).focus();
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("menuitem", { name: "Delete project" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Type the project name/), "Core API");
      await user.click(within(dialog).getByRole("button", { name: "Delete project" }));
      await waitFor(() => expect(deleteProject).toHaveBeenCalledWith("p1"));
      expect(await main().findByText("Project deleted")).toBeVisible();
      expect(main().getByRole("link", { name: "Back to workspace" })).toHaveAttribute(
        "href",
        "/workspaces/w1",
      );
    });
  });
});
