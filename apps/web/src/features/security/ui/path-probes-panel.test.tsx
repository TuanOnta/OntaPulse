import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PathProbesPanel, pathProbesStateText } from "./path-probes-panel";

type Props = Partial<React.ComponentProps<typeof PathProbesPanel>>;

function setup(props: Props = {}) {
  const onEnable = vi.fn().mockResolvedValue(undefined);
  const onDisable = vi.fn();
  render(
    <PathProbesPanel
      acknowledgedAt={null}
      canManage
      enabled={false}
      host="api.example.com"
      onDisable={onDisable}
      onEnable={onEnable}
      saving={false}
      securityEnabled
      {...props}
    />,
  );
  return { onEnable, onDisable };
}

describe("pathProbesStateText", () => {
  it("says off, on with the acknowledgment time, and on without one", () => {
    expect(pathProbesStateText(false, null)).toBe("Off. Not requested.");
    expect(pathProbesStateText(false, "2026-10-20T10:00:00Z")).toBe("Off. Not requested.");
    expect(pathProbesStateText(true, "2026-10-20T10:00:00Z")).toMatch(/^On\. Acknowledged .+\.$/);
    expect(pathProbesStateText(true, null)).toBe("On.");
  });
});

describe("PathProbesPanel", () => {
  it("explains the check and shows its state", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Exposed-file checks" })).toBeVisible();
    expect(screen.getByText(/Requests three fixed paths on this host/)).toBeVisible();
    expect(screen.getByText(/Runs with security scans\./)).toBeVisible();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent("Off. Not requested.");
    expect(screen.getByRole("switch", { name: "Exposed-file checks" })).not.toBeChecked();
  });

  it("notes that nothing runs yet while the security checks are off", () => {
    setup({ securityEnabled: false });

    expect(screen.getByText(/Security checks are off, so nothing runs yet\./)).toBeVisible();
  });

  it("opens the confirmation instead of enabling right away", async () => {
    const user = userEvent.setup();
    const { onEnable } = setup();

    await user.click(screen.getByRole("switch", { name: "Exposed-file checks" }));

    expect(screen.getByRole("dialog", { name: "Check for exposed files?" })).toBeVisible();
    expect(onEnable).not.toHaveBeenCalled();
    // The switch only moves once the API accepted the change (the open dialog hides the page from the
    // accessibility tree, hence `hidden`).
    expect(
      screen.getByRole("switch", { name: "Exposed-file checks", hidden: true }),
    ).not.toBeChecked();
  });

  it("enables after the checkbox and closes the dialog", async () => {
    const user = userEvent.setup();
    const { onEnable } = setup();

    await user.click(screen.getByRole("switch", { name: "Exposed-file checks" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    expect(onEnable).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open when enabling fails", async () => {
    const user = userEvent.setup();
    const onEnable = vi.fn().mockRejectedValue(new Error("nope"));
    setup({ onEnable });

    await user.click(screen.getByRole("switch", { name: "Exposed-file checks" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not complete that request. Try again.",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("turns off without a dialog", async () => {
    const user = userEvent.setup();
    const { onDisable } = setup({ enabled: true, acknowledgedAt: "2026-10-20T10:00:00Z" });

    expect(screen.getByTestId("path-probes-state")).toHaveTextContent(/On\. Acknowledged/);
    await user.click(screen.getByRole("switch", { name: "Exposed-file checks" }));

    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the switch while a change is being saved", () => {
    setup({ enabled: true, saving: true });

    expect(screen.getByRole("switch", { name: "Exposed-file checks" })).toBeDisabled();
  });

  it("gives a member the state as text only", () => {
    setup({ canManage: false, enabled: true, acknowledgedAt: "2026-10-20T10:00:00Z" });

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent(/On\. Acknowledged/);
  });
});
