import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
  Crumbs: () => null,
}));
vi.mock("@/shared/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...actual, api: { ...actual.api, scan: mocks.scan } };
});
vi.mock("react-router-dom", () => ({ useParams: () => ({ scanId: "scan-1" }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { ScanPage } from "./scan-page";

describe("ScanPage", () => {
  it("renders the completed scan and its findings", async () => {
    mocks.scan.mockResolvedValue({
      id: "scan-1",
      monitorId: "monitor-1",
      status: "SUCCEEDED",
      statusCode: 503,
      responseTimeMs: 245,
      createdAt: "2026-09-22T00:00:00.000Z",
      finishedAt: "2026-09-22T00:00:01.000Z",
      findings: [
        {
          id: "finding-1",
          scanId: "scan-1",
          code: "HTTP_5XX",
          title: "Server error",
          severity: "HIGH",
          description: "The target returned an error response.",
          recommendation: "Inspect the upstream service.",
          createdAt: "2026-09-22T00:00:01.000Z",
        },
      ],
    });

    render(<ScanPage />);

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Run scan-1" })).toBeInTheDocument();
    expect(screen.getByText("245 ms")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.getByText("Recommended:")).toBeInTheDocument();
  });

  it("reports a loading failure and leaves the safe loading state visible", async () => {
    mocks.scan.mockRejectedValue(new Error("Network unavailable"));

    render(<ScanPage />);

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Could not complete that request. Try again.");
    });
    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });
});
