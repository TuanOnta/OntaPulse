import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scan: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { scan: mocks.scan } };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { ApiError } from "@/shared/api/client";

import { SCAN_DETAIL_POLL_MS, useScanDetail } from "./use-scan-detail";

const scan = (status: string) => ({
  id: "s1",
  monitorId: "m1",
  status,
  findings: [],
  createdAt: "x",
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});
afterEach(() => vi.useRealTimers());

async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useScanDetail", () => {
  it("loads a finished scan once and does not poll", async () => {
    mocks.scan.mockResolvedValue(scan("SUCCEEDED"));
    const { result } = renderHook(() => useScanDetail("s1"));
    expect(result.current.status).toBe("loading");
    await tick();
    expect(result.current.status).toBe("ready");
    await tick(SCAN_DETAIL_POLL_MS * 3);
    expect(mocks.scan).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("follows a scan to its result and announces it once", async () => {
    mocks.scan.mockResolvedValueOnce(scan("QUEUED")).mockResolvedValueOnce(scan("RUNNING"));
    const { result } = renderHook(() => useScanDetail("s1"));
    await tick();
    await tick(SCAN_DETAIL_POLL_MS);
    expect(result.current.scan?.status).toBe("RUNNING");
    mocks.scan.mockResolvedValue(scan("SUCCEEDED"));
    await tick(SCAN_DETAIL_POLL_MS);
    expect(result.current.scan?.status).toBe("SUCCEEDED");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Scan finished.");
    const calls = mocks.scan.mock.calls.length;
    await tick(SCAN_DETAIL_POLL_MS * 3);
    expect(mocks.scan).toHaveBeenCalledTimes(calls);
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
  });

  it("announces a failed scan as an error", async () => {
    mocks.scan.mockResolvedValueOnce(scan("RUNNING"));
    renderHook(() => useScanDetail("s1"));
    await tick();
    mocks.scan.mockResolvedValue(scan("FAILED"));
    await tick(SCAN_DETAIL_POLL_MS);
    expect(mocks.toastError).toHaveBeenCalledWith("Scan failed.");
  });

  it("reports not found for a 404 and an error otherwise", async () => {
    mocks.scan.mockRejectedValueOnce(new ApiError({ statusCode: 404, code: "NF", message: "nf" }));
    const first = renderHook(() => useScanDetail("s1"));
    await tick();
    expect(first.result.current.status).toBe("notfound");

    mocks.scan.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-1" }),
    );
    const second = renderHook(() => useScanDetail("s2"));
    await tick();
    expect(second.result.current.error).toEqual({ message: "Down", requestId: "req-1" });
  });

  it("starts over when another scan is opened and stops polling on unmount", async () => {
    mocks.scan.mockResolvedValue(scan("RUNNING"));
    const { result, rerender, unmount } = renderHook(({ id }) => useScanDetail(id), {
      initialProps: { id: "s1" },
    });
    await tick();
    rerender({ id: "s2" });
    expect(result.current.status).toBe("loading");
    await tick();
    expect(mocks.scan).toHaveBeenLastCalledWith("s2");
    unmount();
    const calls = mocks.scan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(SCAN_DETAIL_POLL_MS * 4);
    expect(mocks.scan).toHaveBeenCalledTimes(calls);
  });
});
