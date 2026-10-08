import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  onCreated: vi.fn(),
  onOpenChange: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { createMonitor: mocks.createMonitor } };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { ApiError } from "@/shared/api/client";

import { CreateMonitorDialog } from "./create-monitor-dialog";

function setup(existingUrls: string[] = []) {
  render(
    <CreateMonitorDialog
      existingUrls={existingUrls}
      onCreated={mocks.onCreated}
      onOpenChange={mocks.onOpenChange}
      open
      projectId="project-1"
    />,
  );
}

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

describe("CreateMonitorDialog", () => {
  it("creates a monitor with the default interval and a name taken from the host", async () => {
    const user = userEvent.setup();
    mocks.createMonitor.mockResolvedValue({});
    setup();
    await user.type(screen.getByLabelText("Target URL"), "https://api.example.com/health");
    await user.click(screen.getByRole("button", { name: "Add monitor" }));
    await waitFor(() =>
      expect(mocks.createMonitor).toHaveBeenCalledWith("project-1", {
        name: "api.example.com",
        targetUrl: "https://api.example.com/health",
        intervalSeconds: 300,
      }),
    );
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.onCreated).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Monitor added for api.example.com.");
  });

  it("uses a preset and shows the human interval", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText("every 5 min")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "1 hour" }));
    expect(screen.getByText("every hour")).toBeVisible();
    expect(screen.getByRole("button", { name: "1 hour" })).toHaveAttribute("aria-pressed", "true");
  });

  it("validates the URL, a duplicate and the interval without calling the API", async () => {
    const user = userEvent.setup();
    setup(["https://dup.example.com"]);
    await user.click(screen.getByRole("button", { name: "Add monitor" }));
    expect(screen.getByText("Enter a URL.")).toBeVisible();
    expect(screen.getByLabelText("Target URL")).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText("Target URL"), "https://dup.example.com");
    await user.click(screen.getByRole("button", { name: "Add monitor" }));
    expect(screen.getByText("This URL is already monitored in this project.")).toBeVisible();

    await user.clear(screen.getByLabelText("Target URL"));
    await user.type(screen.getByLabelText("Target URL"), "https://ok.example.com");
    await user.clear(screen.getByLabelText("Check interval"));
    await user.type(screen.getByLabelText("Check interval"), "30");
    await user.click(screen.getByRole("button", { name: "Add monitor" }));
    expect(screen.getByText("Use a whole number from 60 to 86,400 seconds.")).toBeVisible();
    expect(mocks.createMonitor).not.toHaveBeenCalled();
  });

  it("shows the API message under the URL field (private target, duplicate)", async () => {
    const user = userEvent.setup();
    mocks.createMonitor.mockRejectedValue(
      new ApiError({
        statusCode: 422,
        code: "UNSAFE_TARGET",
        message: "Private targets are not allowed.",
      }),
    );
    setup();
    await user.type(screen.getByLabelText("Target URL"), "http://10.0.0.1");
    await user.click(screen.getByRole("button", { name: "Add monitor" }));
    expect(await screen.findByText("Private targets are not allowed.")).toBeVisible();
    expect(mocks.onCreated).not.toHaveBeenCalled();
  });
});
