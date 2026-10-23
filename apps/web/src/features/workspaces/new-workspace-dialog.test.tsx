import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { createWorkspace: mocks.createWorkspace } };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { FirstWorkspaceForm } from "./first-workspace-form";
import { validateWorkspaceName } from "./model/use-create-workspace";
import { NewWorkspaceDialog } from "./new-workspace-dialog";

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

describe("validateWorkspaceName", () => {
  it("requires a name of at most 120 characters after trimming", () => {
    expect(validateWorkspaceName("")).toBe("Workspace name is required.");
    expect(validateWorkspaceName("   ")).toBe("Workspace name is required.");
    expect(validateWorkspaceName("x".repeat(121))).toBe("Use 120 characters or fewer.");
    expect(validateWorkspaceName(` ${"x".repeat(120)} `)).toBeNull();
  });
});

describe("NewWorkspaceDialog", () => {
  function setup() {
    const onOpenChange = vi.fn();
    render(<NewWorkspaceDialog onOpenChange={onOpenChange} open />);
    return onOpenChange;
  }

  it("shows the copy, a live counter and the hint", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole("dialog", { name: "New workspace" })).toBeVisible();
    expect(screen.getByText(/You will be its owner/)).toBeVisible();
    expect(screen.getByText("You can add members once it is created.")).toBeVisible();
    expect(screen.getByText("0 / 120")).toBeVisible();
    await user.type(screen.getByLabelText("Workspace name"), "Acme");
    expect(screen.getByText("4 / 120")).toBeVisible();
  });

  it("creates the workspace, toasts and navigates to it", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1" });
    setup();
    await user.type(screen.getByLabelText("Workspace name"), "  Platform engineering ");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() => expect(mocks.createWorkspace).toHaveBeenCalledWith("Platform engineering"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Workspace “Platform engineering” created. Opening it…",
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/workspaces/workspace-1");
  });

  it("explains an empty or too long name and does not call the API", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(screen.getByText("Workspace name is required.")).toBeVisible();
    expect(screen.getByLabelText("Workspace name")).toHaveAttribute("aria-invalid", "true");
    await user.type(screen.getByLabelText("Workspace name"), "x".repeat(121));
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(screen.getByText("Use 120 characters or fewer.")).toBeVisible();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  it("shows the API message under the field when creation fails", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockRejectedValue(
      new ApiError({ statusCode: 500, code: "BOOM", message: "The API is unavailable." }),
    );
    setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(await screen.findByText("The API is unavailable.")).toBeVisible();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("closes the dialog once the workspace was created", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1" });
    const onOpenChange = setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme{Enter}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.navigate).toHaveBeenCalledWith("/workspaces/workspace-1");
  });

  it("keeps the dialog open and shows the API message when the name is already taken", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockRejectedValue(
      new ApiError({
        statusCode: 409,
        code: "WORKSPACE_NAME_TAKEN",
        message: "You already have a workspace with this name.",
      }),
    );
    const onOpenChange = setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme{Enter}");
    expect(await screen.findByText("You already have a workspace with this name.")).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Workspace name")).toHaveFocus();
  });

  it("sends one request when Enter is pressed twice while it is running", async () => {
    const user = userEvent.setup();
    let resolve: (workspace: { id: string }) => void = () => {};
    mocks.createWorkspace.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme{Enter}{Enter}{Enter}");
    expect(mocks.createWorkspace).toHaveBeenCalledTimes(1);
    resolve({ id: "workspace-1" });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
  });

  it("does not create a second workspace when Enter is pressed again after success", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue({ id: "workspace-1" });
    setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme{Enter}");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Workspace name"), "{Enter}");
    expect(mocks.createWorkspace).toHaveBeenCalledTimes(1);
  });

  it("allows another try after a failure", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace
      .mockRejectedValueOnce(new ApiError({ statusCode: 500, code: "BOOM", message: "Nope." }))
      .mockResolvedValueOnce({ id: "workspace-2" });
    setup();
    await user.type(screen.getByLabelText("Workspace name"), "Acme{Enter}");
    expect(await screen.findByText("Nope.")).toBeVisible();
    await user.type(screen.getByLabelText("Workspace name"), "{Enter}");
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/workspaces/workspace-2"));
    expect(mocks.createWorkspace).toHaveBeenCalledTimes(2);
  });

  it("closes with Cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("FirstWorkspaceForm", () => {
  it("limits the name to 120 characters and creates the workspace", async () => {
    const user = userEvent.setup();
    mocks.createWorkspace.mockResolvedValue({ id: "w1" });
    render(<FirstWorkspaceForm />);
    expect(screen.getByLabelText("Workspace name")).toHaveAttribute("maxlength", "120");
    await user.type(screen.getByLabelText("Workspace name"), "First");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/workspaces/w1"));
  });

  it("asks for a name when the field is empty", async () => {
    const user = userEvent.setup();
    render(<FirstWorkspaceForm />);
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(screen.getByText("Workspace name is required.")).toBeVisible();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });
});
