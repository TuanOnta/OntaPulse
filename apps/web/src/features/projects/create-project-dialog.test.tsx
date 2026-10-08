import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  onCreated: vi.fn(),
  onOpenChange: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({ api: { createProject: mocks.createProject } }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { CreateProjectDialog, validateProject } from "./create-project-dialog";

function setup() {
  mocks.createProject.mockReset();
  mocks.onCreated.mockReset();
  mocks.onOpenChange.mockReset();
  render(
    <CreateProjectDialog
      onCreated={mocks.onCreated}
      onOpenChange={mocks.onOpenChange}
      open
      workspaceId="workspace-1"
    />,
  );
}

describe("validateProject", () => {
  it("requires a name and enforces both limits", () => {
    expect(validateProject("", "")).toEqual({ name: "Project name is required." });
    expect(validateProject("a".repeat(121), "").name).toBe("Use 120 characters or fewer.");
    expect(validateProject("ok", "d".repeat(501)).description).toBe("Use 500 characters or fewer.");
    expect(validateProject("a".repeat(120), "d".repeat(500))).toEqual({});
  });
});

describe("CreateProjectDialog", () => {
  it("creates a project, closes and asks the page to refresh", async () => {
    const user = userEvent.setup();
    setup();
    mocks.createProject.mockResolvedValue({});

    await user.type(screen.getByLabelText("Name"), "  Public API ");
    await user.type(screen.getByLabelText(/Description/), "Customer-facing service");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => {
      expect(mocks.createProject).toHaveBeenCalledWith(
        "workspace-1",
        "Public API",
        "Customer-facing service",
      );
      expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
      expect(mocks.onCreated).toHaveBeenCalledOnce();
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Project “Public API” created.");
  });

  it("shows the required-name error and does not call the API", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByText("Project name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createProject).not.toHaveBeenCalled();
  });
});
