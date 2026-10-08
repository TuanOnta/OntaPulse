import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerScan: vi.fn(),
  scan: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { triggerScan: mocks.triggerScan, scan: mocks.scan } };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { SCAN_POLL_MS, useScanRuns } from "./use-scan-runs";

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});
afterEach(() => vi.useRealTimers());

describe("useScanRuns", () => {
  it("follows a scan from queued to running to a terminal status and then stops", async () => {
    mocks.triggerScan.mockResolvedValue({ id: "s1", status: "QUEUED" });
    mocks.scan
      .mockResolvedValueOnce({ status: "RUNNING", findings: [] })
      .mockResolvedValueOnce({ status: "SUCCEEDED", findings: [{}] });
    const { result } = renderHook(() => useScanRuns());

    await act(async () => {
      await result.current.start("m1", "api.example.com");
    });
    expect(result.current.runs.m1.phase).toBe("queued");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Scan queued for api.example.com.");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_POLL_MS);
    });
    expect(result.current.runs.m1.phase).toBe("running");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_POLL_MS);
    });
    expect(result.current.runs.m1).toEqual({ phase: "succeeded", findingCount: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_POLL_MS * 5);
    });
    expect(mocks.scan).toHaveBeenCalledTimes(2);
  });

  it("drops the run and shows the API error when the scan cannot be triggered", async () => {
    mocks.triggerScan.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useScanRuns());
    await act(async () => {
      await result.current.start("m1", "x");
    });
    expect(result.current.runs.m1).toBeUndefined();
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });

  it("stops polling on unmount", async () => {
    mocks.triggerScan.mockResolvedValue({ id: "s1", status: "QUEUED" });
    mocks.scan.mockResolvedValue({ status: "RUNNING", findings: [] });
    const { result, unmount } = renderHook(() => useScanRuns());
    await act(async () => {
      await result.current.start("m1", "x");
    });
    unmount();
    await vi.advanceTimersByTimeAsync(SCAN_POLL_MS * 4);
    expect(mocks.scan).not.toHaveBeenCalled();
  });
});
