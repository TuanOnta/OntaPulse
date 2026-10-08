import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RenameDialog, validateRename } from "./rename-dialog";

function setup(onSubmit = vi.fn().mockResolvedValue(undefined), withDescription = true) {
  render(
    <RenameDialog
      initialDescription="Old text"
      initialName="Core API"
      kind="project"
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
      open
      withDescription={withDescription}
    />,
  );
  return onSubmit;
}

describe("validateRename", () => {
  it("requires a name and enforces both limits", () => {
    expect(validateRename("", "", "project").name).toBe("Project name is required.");
    expect(validateRename("x".repeat(121), "", "workspace").name).toBe(
      "Use 120 characters or fewer.",
    );
    expect(validateRename("ok", "d".repeat(501), "project").description).toBe(
      "Use 500 characters or fewer.",
    );
    expect(validateRename("ok", "d".repeat(500), "project")).toEqual({});
  });
});

describe("RenameDialog", () => {
  it("starts from the current values and submits the trimmed ones", async () => {
    const user = userEvent.setup();
    const onSubmit = setup();
    expect(screen.getByLabelText("Name")).toHaveValue("Core API");
    expect(screen.getByLabelText(/Description/)).toHaveValue("Old text");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "  Core API v2 ");
    await user.clear(screen.getByLabelText(/Description/));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Core API v2", ""));
  });

  it("shows the required error and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = setup();
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Project name is required.")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the description for a workspace and shows request errors under the name", async () => {
    const user = userEvent.setup();
    setup(vi.fn().mockRejectedValue(new Error("boom")), false);
    expect(screen.queryByLabelText(/Description/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Could not complete that request. Try again.")).toBeVisible();
  });
});
