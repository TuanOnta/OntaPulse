import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scans: vi.fn(),
  triggerScan: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { scans: mocks.scans, triggerScan: mocks.triggerScan } };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { SCAN_LIST_POLL_MS, useMonitorScans } from "./use-monitor-scans";

const scan = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  monitorId: "m1",
  status,
  createdAt: "2026-10-08T12:00:00Z",
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});
afterEach(() => vi.useRealTimers());

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useMonitorScans", () => {
  it("loads the history and does not poll while nothing is busy", async () => {
    mocks.scans.mockResolvedValue([scan("s1", "SUCCEEDED")]);
    const { result } = renderHook(() => useMonitorScans("m1"));
    expect(result.current.status).toBe("loading");
    await flush();
    expect(result.current.status).toBe("ready");
    expect(result.current.scans).toHaveLength(1);
    expect(result.current.busy).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS * 3);
    });
    expect(mocks.scans).toHaveBeenCalledTimes(1);
  });

  it("puts a new scan on top, follows it until it finishes and announces the result once", async () => {
    mocks.scans.mockResolvedValueOnce([scan("s1", "SUCCEEDED")]);
    mocks.triggerScan.mockResolvedValue(scan("s2", "QUEUED"));
    const { result } = renderHook(() => useMonitorScans("m1"));
    await flush();

    await act(async () => {
      await result.current.run("api.example.com");
    });
    expect(result.current.scans.map((item) => item.id)).toEqual(["s2", "s1"]);
    expect(result.current.freshId).toBe("s2");
    expect(result.current.busy).toBe(true);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Scan queued for api.example.com.");

    mocks.scans.mockResolvedValueOnce([scan("s2", "RUNNING"), scan("s1", "SUCCEEDED")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS);
    });
    expect(result.current.scans[0].status).toBe("RUNNING");

    mocks.scans.mockResolvedValue([
      scan("s2", "SUCCEEDED", { statusCode: 200, responseTimeMs: 214 }),
      scan("s1", "SUCCEEDED"),
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS);
    });
    expect(result.current.busy).toBe(false);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Scan finished: HTTP 200 in 214 ms.");
    const calls = mocks.scans.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS * 3);
    });
    expect(mocks.scans).toHaveBeenCalledTimes(calls);
    expect(
      mocks.toastSuccess.mock.calls.filter(([text]) => String(text).startsWith("Scan finished")),
    ).toHaveLength(1);
  });

  it("reports a failed scan as an error toast", async () => {
    mocks.scans.mockResolvedValueOnce([]);
    mocks.triggerScan.mockResolvedValue(scan("s1", "QUEUED"));
    const { result } = renderHook(() => useMonitorScans("m1"));
    await flush();
    await act(async () => {
      await result.current.run("x");
    });
    mocks.scans.mockResolvedValue([scan("s1", "FAILED", { errorMessage: "Request timed out" })]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS);
    });
    expect(mocks.toastError).toHaveBeenCalledWith("Scan failed: Request timed out");
  });

  it("shows the API error when the scan cannot be triggered", async () => {
    mocks.scans.mockResolvedValueOnce([]);
    mocks.triggerScan.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useMonitorScans("m1"));
    await flush();
    await act(async () => {
      await result.current.run("x");
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(result.current.scans).toHaveLength(0);
    expect(result.current.running).toBe(false);
  });

  it("stops polling on unmount", async () => {
    mocks.scans.mockResolvedValue([scan("s1", "RUNNING")]);
    const { unmount } = renderHook(() => useMonitorScans("m1"));
    await flush();
    unmount();
    const calls = mocks.scans.mock.calls.length;
    await vi.advanceTimersByTimeAsync(SCAN_LIST_POLL_MS * 4);
    expect(mocks.scans).toHaveBeenCalledTimes(calls);
  });

  it("exposes the error and reloads", async () => {
    mocks.scans.mockRejectedValueOnce(new Error("x"));
    const { result } = renderHook(() => useMonitorScans("m1"));
    await flush();
    expect(result.current.status).toBe("error");
    mocks.scans.mockResolvedValue([]);
    act(() => result.current.reload());
    await flush();
    expect(result.current.status).toBe("ready");
  });
});
