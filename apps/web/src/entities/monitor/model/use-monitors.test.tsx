import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ monitors: vi.fn() }));
vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { ...original.api, monitors: mocks.monitors } };
});

import { useMonitors } from "./use-monitors";

const monitor = (id: string) => ({
  id,
  projectId: "p1",
  name: `Monitor ${id}`,
  targetUrl: `https://${id}.example.com`,
  intervalSeconds: 300,
  isActive: true,
  createdAt: "2026-03-18T14:40:00Z",
  updatedAt: "2026-03-18T14:40:00Z",
});

beforeEach(() => mocks.monitors.mockReset());

describe("useMonitors refresh", () => {
  it("adds new rows without showing the loading state", async () => {
    mocks.monitors
      .mockResolvedValueOnce([monitor("a")])
      .mockResolvedValueOnce([monitor("a"), monitor("b")]);
    const { result } = renderHook(() => useMonitors("p1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const seen: string[] = [];
    await act(async () => {
      const pending = result.current.refresh();
      seen.push(result.current.status);
      await pending;
    });

    expect(seen).toEqual(["ready"]);
    expect(result.current.monitors.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("falls back to the normal load, and its error banner, when the refresh fails", async () => {
    mocks.monitors
      .mockResolvedValueOnce([monitor("a")])
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMonitors("p1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
