import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ projects: vi.fn() }));
vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return { ...original, api: { ...original.api, projects: mocks.projects } };
});

import { useProjects } from "./use-projects";

const project = (id: string) => ({
  id,
  workspaceId: "w1",
  name: `Project ${id}`,
  description: null,
  createdAt: "2026-03-18T14:20:00Z",
  updatedAt: "2026-03-18T14:20:00Z",
});

beforeEach(() => mocks.projects.mockReset());

describe("useProjects refresh", () => {
  it("adds new rows without showing the loading state", async () => {
    mocks.projects
      .mockResolvedValueOnce([project("p1")])
      .mockResolvedValueOnce([project("p1"), project("p2")]);
    const { result } = renderHook(() => useProjects("w1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const seen: string[] = [];
    const promise = act(async () => {
      const pending = result.current.refresh();
      seen.push(result.current.status);
      await pending;
    });
    await promise;

    expect(seen).toEqual(["ready"]);
    expect(result.current.projects.map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("falls back to the normal load, and its error banner, when the refresh fails", async () => {
    mocks.projects
      .mockResolvedValueOnce([project("p1")])
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useProjects("w1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
