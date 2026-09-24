import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  onCreated: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({ api: { createMonitor: mocks.createMonitor } }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { CreateMonitorForm } from "./create-monitor-form";

describe("CreateMonitorForm", () => {
  it("creates a monitor with the default five-minute interval", async () => {
    const user = userEvent.setup();
    mocks.createMonitor.mockResolvedValue({});
    mocks.onCreated.mockResolvedValue(undefined);
    render(<CreateMonitorForm projectId="project-1" onCreated={mocks.onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Marketing homepage");
    await user.type(screen.getByLabelText("Target URL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Add monitor" }));

    await waitFor(() => {
      expect(mocks.createMonitor).toHaveBeenCalledWith("project-1", {
        name: "Marketing homepage",
        targetUrl: "https://example.com",
        intervalSeconds: 300,
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Monitor created");
      expect(mocks.onCreated).toHaveBeenCalledOnce();
    });
  });
});
