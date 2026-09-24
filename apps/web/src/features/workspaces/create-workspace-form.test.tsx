import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({ api: { createWorkspace: mocks.createWorkspace } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { CreateWorkspaceForm } from "./create-workspace-form";

describe("CreateWorkspaceForm", () => {
  it("creates a workspace and navigates to it", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1" });
    render(<CreateWorkspaceForm />);

    await user.type(screen.getByLabelText("Workspace name"), "Platform engineering");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => {
      expect(mocks.createWorkspace).toHaveBeenCalledWith("Platform engineering");
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Workspace created");
      expect(mocks.navigate).toHaveBeenCalledWith("/workspaces/workspace-1");
    });
  });
});
