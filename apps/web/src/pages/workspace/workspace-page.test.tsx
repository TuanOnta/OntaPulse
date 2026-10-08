import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type { Project, Workspace, WorkspaceMember, WorkspaceRole } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  projects: vi.fn(),
  members: vi.fn(),
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
      workspaceMembers: mocks.members,
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

import { WorkspacePage } from "./workspace-page";

const workspace = (role: WorkspaceRole): Workspace => ({
  id: "w1",
  name: "MrScraper Platform",
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});

const project = (id: string, name: string, description: string | null): Project => ({
  id,
  workspaceId: "w1",
  name,
  description,
  createdAt: "2026-03-06T09:00:00Z",
  updatedAt: "2026-03-06T09:00:00Z",
});

const PEOPLE: WorkspaceMember[] = [
  { id: "u1", name: "Dzaki Arta", email: "dzaki@example.com", role: "OWNER", joinedAt: "x" },
  { id: "u2", name: "Dimas", email: "dimas@example.com", role: "ADMIN", joinedAt: "x" },
];

function renderPage(path = "/workspaces/w1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<WorkspacePage />} path="/workspaces/:workspaceId" />
        <Route element={<p>Dashboard</p>} path="/dashboard" />
      </Routes>
    </MemoryRouter>,
  );
}

const main = () => within(screen.getByRole("main"));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.workspaces.mockResolvedValue([workspace("OWNER")]);
  mocks.projects.mockResolvedValue([
    project("p1", "Marketing site", "Public pages"),
    project("p2", "Partner webhooks", null),
  ]);
  mocks.members.mockResolvedValue(PEOPLE);
});

describe("WorkspacePage", () => {
  it("shows the hero, counts and project cards for an owner", async () => {
    renderPage();
    expect(
      await main().findByRole("heading", { level: 1, name: "MrScraper Platform" }),
    ).toBeVisible();
    expect(
      await main().findByRole("link", { name: "Open project Marketing site" }),
    ).toHaveAttribute("href", "/workspaces/w1/projects/p1");
    expect(main().getByText("No description")).toBeVisible();
    expect(main().getByText("2 projects")).toBeVisible();
    expect(await main().findByText("2 members")).toBeVisible();
    expect(main().getAllByRole("button", { name: "New project" }).length).toBeGreaterThan(0);
    expect(main().getByRole("tab", { name: /Projects/ })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to Members with the keyboard and with ?tab=members", async () => {
    const user = userEvent.setup();
    renderPage();
    const projectsTab = await main().findByRole("tab", { name: /Projects/ });
    projectsTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(main().getByRole("tab", { name: /Members/ })).toHaveAttribute("aria-selected", "true");
    expect(await main().findByRole("table", { name: "Workspace members" })).toBeVisible();
  });

  it("opens straight on Members from the URL", async () => {
    renderPage("/workspaces/w1?tab=members");
    expect(await main().findByRole("table", { name: "Workspace members" })).toBeVisible();
  });

  it("hides management actions for a MEMBER", async () => {
    mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
    renderPage();
    expect(await main().findByText(/View-only access/)).toBeVisible();
    expect(main().queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    expect(main().queryByRole("button", { name: "Add member" })).not.toBeInTheDocument();
  });

  it("shows the empty state, with a call to action only for managers", async () => {
    mocks.projects.mockResolvedValue([]);
    renderPage();
    expect(await main().findByText("No projects yet")).toBeVisible();
    expect(main().getByText(/Create a project, then add the first monitor/)).toBeVisible();
  });

  it("shows not found when the workspace is not in the user's list", async () => {
    mocks.workspaces.mockResolvedValue([]);
    renderPage();
    expect(await main().findByText("Workspace not found")).toBeVisible();
    expect(main().getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("shows not found when the projects request answers 404", async () => {
    mocks.projects.mockRejectedValue(
      new ApiError({ statusCode: 404, code: "NOT_FOUND", message: "Workspace not found" }),
    );
    renderPage();
    expect(await main().findByText("Workspace not found")).toBeVisible();
  });

  it("shows the error banner with the request id and retries", async () => {
    const user = userEvent.setup();
    mocks.workspaces.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-7" }),
    );
    renderPage();
    expect(await main().findByText("Couldn’t load this workspace.")).toBeVisible();
    expect(main().getByText(/req-7/)).toBeVisible();
    await user.click(main().getByRole("button", { name: "Try again" }));
    expect(
      await main().findByRole("heading", { level: 1, name: "MrScraper Platform" }),
    ).toBeVisible();
  });

  it("creates a project from the dialog and reloads the list", async () => {
    const user = userEvent.setup();
    const createProject = vi.fn().mockResolvedValue(project("p3", "New one", null));
    const { api } = await import("@/shared/api/client");
    Object.assign(api, { createProject });
    renderPage();
    await user.click((await main().findAllByRole("button", { name: "New project" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "New one");
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(createProject).toHaveBeenCalledWith("w1", "New one", ""));
    await waitFor(() => expect(mocks.projects).toHaveBeenCalledTimes(2));
  });

  describe("rename and delete", () => {
    async function openMenu(user: ReturnType<typeof userEvent.setup>) {
      const trigger = await main().findByRole("button", { name: "Workspace settings" });
      trigger.focus();
      await user.keyboard("{Enter}");
    }

    it("is available to OWNER with both items enabled", async () => {
      const user = userEvent.setup();
      renderPage();
      await openMenu(user);
      expect(await screen.findByRole("menuitem", { name: "Rename workspace" })).toBeVisible();
      expect(screen.getByRole("menuitem", { name: "Delete workspace" })).not.toHaveAttribute(
        "data-disabled",
      );
    });

    it("shows Delete disabled with the reason for an ADMIN", async () => {
      const user = userEvent.setup();
      mocks.workspaces.mockResolvedValue([workspace("ADMIN")]);
      renderPage();
      await openMenu(user);
      expect(await screen.findByRole("menuitem", { name: "Delete workspace" })).toHaveAttribute(
        "data-disabled",
      );
      expect(screen.getByText("Only owners can delete a workspace.")).toBeVisible();
    });

    it("has no menu for a MEMBER", async () => {
      mocks.workspaces.mockResolvedValue([workspace("MEMBER")]);
      renderPage();
      await main().findByText(/View-only access/);
      expect(main().queryByRole("button", { name: "Workspace settings" })).not.toBeInTheDocument();
    });

    it("renames the workspace and updates the title", async () => {
      const user = userEvent.setup();
      const renameWorkspace = vi.fn().mockResolvedValue({ ...workspace("OWNER"), name: "Renamed" });
      const { api } = await import("@/shared/api/client");
      Object.assign(api, { renameWorkspace });
      renderPage();
      await openMenu(user);
      await user.click(await screen.findByRole("menuitem", { name: "Rename workspace" }));
      const dialog = await screen.findByRole("dialog");
      await user.clear(within(dialog).getByLabelText("Name"));
      await user.type(within(dialog).getByLabelText("Name"), "Renamed");
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(renameWorkspace).toHaveBeenCalledWith("w1", "Renamed"));
      expect(await main().findByRole("heading", { level: 1, name: "Renamed" })).toBeVisible();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("deletes after the name is typed and shows the deleted panel", async () => {
      const user = userEvent.setup();
      const deleteWorkspace = vi.fn().mockResolvedValue(undefined);
      const { api } = await import("@/shared/api/client");
      Object.assign(api, { deleteWorkspace });
      renderPage();
      await openMenu(user);
      await user.click(await screen.findByRole("menuitem", { name: "Delete workspace" }));
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Delete workspace" });
      expect(confirm).toBeDisabled();
      await user.type(
        within(dialog).getByLabelText(/Type the workspace name/),
        "MrScraper Platform",
      );
      await user.click(confirm);
      await waitFor(() => expect(deleteWorkspace).toHaveBeenCalledWith("w1"));
      expect(await main().findByText("Workspace deleted")).toBeVisible();
      expect(main().getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
        "href",
        "/dashboard",
      );
    });
  });
});
