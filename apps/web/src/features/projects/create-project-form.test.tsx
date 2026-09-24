import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  onCreated: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({ api: { createProject: mocks.createProject } }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { CreateProjectForm } from "./create-project-form";

describe("CreateProjectForm", () => {
  it("creates a project and refreshes the project list", async () => {
    const user = userEvent.setup();
    mocks.createProject.mockResolvedValue({});
    mocks.onCreated.mockResolvedValue(undefined);
    render(<CreateProjectForm workspaceId="workspace-1" onCreated={mocks.onCreated} />);

    await user.type(screen.getByLabelText("Project name"), "Public API");
    await user.type(screen.getByLabelText(/Description/), "Customer-facing service");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => {
      expect(mocks.createProject).toHaveBeenCalledWith(
        "workspace-1",
        "Public API",
        "Customer-facing service",
      );
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Project created");
      expect(mocks.onCreated).toHaveBeenCalledOnce();
    });
  });
});
