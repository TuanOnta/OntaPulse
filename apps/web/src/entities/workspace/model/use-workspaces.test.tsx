import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";

const mocks = vi.hoisted(() => ({ workspaces: vi.fn() }));
vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { ...original.api, workspaces: mocks.workspaces } };
});

import { useWorkspaces } from "./use-workspaces";

const WORKSPACE = {
  id: "w1",
  name: "One",
  role: "OWNER" as const,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
};

beforeEach(() => {
  mocks.workspaces.mockReset();
});

describe("useWorkspaces", () => {
  it("starts loading and then exposes the workspaces", async () => {
    mocks.workspaces.mockResolvedValue([WORKSPACE]);
    const { result } = renderHook(() => useWorkspaces());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.workspaces).toEqual([WORKSPACE]);
  });

  it("keeps the API message and request id on failure, and reloads on demand", async () => {
    mocks.workspaces
      .mockRejectedValueOnce(
        new ApiError({ statusCode: 500, code: "INTERNAL", message: "Boom", requestId: "req-9" }),
      )
      .mockResolvedValueOnce([WORKSPACE]);
    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toEqual({ message: "Boom", requestId: "req-9" });

    act(() => result.current.reload());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mocks.workspaces).toHaveBeenCalledTimes(2);
  });

  it("uses a generic message for unexpected errors", async () => {
    mocks.workspaces.mockImplementation(async () => {
      throw new TypeError("secret internals");
    });
    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("Check your connection and try again.");
  });
});
