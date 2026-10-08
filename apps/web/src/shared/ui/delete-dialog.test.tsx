import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteDialog, matchesName } from "./delete-dialog";

function setup(onConfirm = vi.fn().mockResolvedValue(undefined)) {
  render(
    <DeleteDialog
      cascade="All its monitors are removed."
      kind="project"
      name="Core API"
      onConfirm={onConfirm}
      onOpenChange={vi.fn()}
      open
    />,
  );
  return onConfirm;
}

describe("matchesName", () => {
  it("needs the exact name, ignoring surrounding spaces", () => {
    expect(matchesName("Core API", "Core API")).toBe(true);
    expect(matchesName("  Core API ", "Core API")).toBe(true);
    expect(matchesName("core api", "Core API")).toBe(false);
    expect(matchesName("", "Core API")).toBe(false);
  });
});

describe("DeleteDialog", () => {
  it("warns about the cascade and keeps the button disabled until the name matches", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText(/will be permanently deleted/)).toBeVisible();
    expect(screen.getByText(/All its monitors are removed/)).toBeVisible();
    const button = screen.getByRole("button", { name: "Delete project" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Type the project name to confirm"), "Core AP");
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Type the project name to confirm"), "I");
    expect(button).toBeEnabled();
  });

  it("confirms once the name is typed", async () => {
    const user = userEvent.setup();
    const onConfirm = setup();
    await user.type(screen.getByLabelText("Type the project name to confirm"), "Core API");
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });

  it("shows the error when the request fails and stays open", async () => {
    const user = userEvent.setup();
    setup(vi.fn().mockRejectedValue(new Error("boom")));
    await user.type(screen.getByLabelText("Type the project name to confirm"), "Core API");
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    expect(await screen.findByText("Could not complete that request. Try again.")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
