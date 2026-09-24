import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "./client";

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends JSON requests with session credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.login("person@example.com", "correct-horse-battery-staple");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "person@example.com",
        password: "correct-horse-battery-staple",
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("preserves a structured API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 409,
            code: "EMAIL_ALREADY_REGISTERED",
            message: "Email exists",
          }),
          { status: 409 },
        ),
      ),
    );

    await expect(
      api.register("Person", "person@example.com", "correct-horse-battery-staple"),
    ).rejects.toMatchObject({
      payload: { code: "EMAIL_ALREADY_REGISTERED", message: "Email exists" },
    });
  });

  it("uses a safe fallback when an error response is not an API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));

    await expect(api.workspaces()).rejects.toEqual(
      new ApiError({
        statusCode: 503,
        code: "API_UNAVAILABLE",
        message: "The API is unavailable. Check that the local API is running.",
      }),
    );
  });
});
