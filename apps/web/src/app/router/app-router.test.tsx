import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Workspace } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  projects: vi.fn(),
  workspaceMembers: vi.fn(),
  createWorkspace: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return {
    ...original,
    api: {
      ...original.api,
      workspaces: mocks.workspaces,
      projects: mocks.projects,
      workspaceMembers: mocks.workspaceMembers,
      createWorkspace: mocks.createWorkspace,
    },
  };
});
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Dzaki Arta", email: "dzaki@example.com" },
    isLoading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AppRoutes } from "./app-router";

const make = (id: string, name: string, role: Workspace["role"] = "OWNER"): Workspace => ({
  id,
  name,
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

// The first visit to a screen loads its code lazily, which can take longer than the default wait on a busy machine.
const LAZY = { timeout: 15_000 };
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.workspaces.mockResolvedValue([make("w1", "Acme Platform"), make("w2", "Other team")]);
  mocks.projects.mockResolvedValue([]);
  mocks.workspaceMembers.mockResolvedValue([]);
  document.title = "OntaPulse";
});

describe("AppRoutes signed-in layout", () => {
  it("keeps the shell between screens and loads the workspace list once", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard");
    expect(await screen.findByRole("heading", { name: /Welcome back/ }, LAZY)).toBeVisible();
    const sidebarLink = screen.getAllByRole("link", { name: /Acme Platform/ })[0]!;

    await user.click(screen.getAllByRole("link", { name: /Open workspace/ })[0]!);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Acme Platform" }, LAZY),
    ).toBeVisible();
    // The same sidebar element is still on screen: the shell was not rebuilt.
    expect(sidebarLink).toBeInTheDocument();

    await user.click(screen.getAllByRole("link", { name: "Dashboard" })[0]!);
    expect(await screen.findByRole("heading", { name: /Welcome back/ }, LAZY)).toBeVisible();
    expect(sidebarLink).toBeInTheDocument();
    expect(mocks.workspaces).toHaveBeenCalledTimes(1);
  });

  it("opens a workspace that was just created, and lists it, without loading the list again", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue(make("w3", "Fresh start"));
    renderAt("/dashboard");
    await screen.findByRole("heading", { name: /Welcome back/ }, LAZY);

    await user.click(screen.getAllByRole("button", { name: "New workspace" })[0]!);
    await user.type(screen.getByLabelText("Workspace name"), "Fresh start{Enter}");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Fresh start" }, LAZY),
    ).toBeVisible();
    expect(screen.queryByText("Workspace not found")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Fresh start/ }).length).toBeGreaterThan(0);
    expect(mocks.workspaces).toHaveBeenCalledTimes(1);
  });

  it("looks the list up once more before saying a workspace was not found", async () => {
    mocks.workspaces
      .mockResolvedValueOnce([make("w1", "Acme Platform")])
      .mockResolvedValueOnce([make("w1", "Acme Platform"), make("w9", "Invited to this")]);
    renderAt("/workspaces/w9");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Invited to this" }, LAZY),
    ).toBeVisible();
    expect(mocks.workspaces).toHaveBeenCalledTimes(2);
  });

  it("says not found only when the fresh list does not have it either", async () => {
    renderAt("/workspaces/nope");

    expect(await screen.findByText("Workspace not found", undefined, LAZY)).toBeVisible();
    await waitFor(() => expect(mocks.workspaces).toHaveBeenCalledTimes(2));
  });

  it("names the tab after the screen", async () => {
    renderAt("/workspaces/w1");

    await screen.findByRole("heading", { level: 1, name: "Acme Platform" }, LAZY);
    expect(document.title).toBe("Acme Platform · OntaPulse");
  });
});
