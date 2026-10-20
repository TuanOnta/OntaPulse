import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";

import { PathProbesDialog } from "./path-probes-dialog";

function setup(onConfirm = vi.fn().mockResolvedValue(undefined)) {
  const onOpenChange = vi.fn();
  render(
    <PathProbesDialog
      host="api.example.com"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("PathProbesDialog", () => {
  it("states what is requested, what is read, and what is stored", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Check for exposed files?" })).toBeVisible();
    expect(screen.getByText(/It reads at most 4 KB of each response/)).toBeVisible();
    expect(screen.getByText(/never the content/)).toBeVisible();
    const paths = screen.getByRole("list", { name: "Requested paths" });
    expect(paths).toHaveTextContent("/.env");
    expect(paths).toHaveTextContent("/.git/HEAD");
    expect(paths).toHaveTextContent("/.git/config");
  });

  it("keeps the confirm button disabled until the authorization box is checked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    const confirm = screen.getByRole("button", { name: "Turn on" });
    const box = screen.getByRole("checkbox", { name: "I am authorized to test api.example.com." });

    expect(box).not.toBeChecked();
    expect(confirm).toBeDisabled();

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(box);
    expect(confirm).toBeEnabled();

    await user.click(box);
    expect(confirm).toBeDisabled();
  });

  it("confirms once the box is checked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on Cancel or Escape", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the API message and request id inline and stays usable after a failure", async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 403,
          code: "INSUFFICIENT_WORKSPACE_ROLE",
          message: "Insufficient workspace role",
          requestId: "req-9",
        }),
      )
      .mockResolvedValueOnce(undefined);
    setup(onConfirm);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    expect(await screen.findByText("Insufficient workspace role")).toBeVisible();
    expect(screen.getByText("Request ID: req-9")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Insufficient workspace role")).toBeNull());
  });

  it("shows a busy label and blocks a second submit while the request runs", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    setup(onConfirm);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    const busy = await screen.findByRole("button", { name: "Turning on…" });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Turning on…" })).toBeNull());
  });

  it("renders the host as text, not as markup", () => {
    render(
      <PathProbesDialog
        host="<img src=x onerror=alert(1)>"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(0);
  });
});
