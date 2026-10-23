import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, onUnauthenticated } from "./client";

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

  it("triggers a security scan with its kind and keeps the plain trigger body-free", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}", { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    await api.triggerSecurityScan("m1");
    await api.triggerScan("m1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/monitors/m1/scans", {
      method: "POST",
      body: JSON.stringify({ kind: "SECURITY_POSTURE" }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/monitors/m1/scans", {
      method: "POST",
      credentials: "include",
      headers: {},
    });
  });

  it("reads and changes the check settings and reads the latest security result", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await api.checkSettings("m1");
    await api.updateCheckSettings("m1", { securityPostureEnabled: true });
    await api.latestSecurityScan("m1");
    await api.edgeProfile("m1");

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method ?? "GET"])).toEqual([
      ["/api/monitors/m1/check-settings", "GET"],
      ["/api/monitors/m1/check-settings", "PATCH"],
      ["/api/monitors/m1/security-posture/latest", "GET"],
      ["/api/monitors/m1/edge-profile", "GET"],
    ]);
    expect(fetchMock.mock.calls[1]?.[1].body).toBe(
      JSON.stringify({ securityPostureEnabled: true }),
    );
  });

  it("keeps numeric error details such as a rate limit wait", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 429,
            code: "SCAN_RATE_LIMITED",
            message: "Scan rate limit reached",
            details: { retryAfterSeconds: 90 },
          }),
          { status: 429 },
        ),
      ),
    );

    const error = await api.triggerSecurityScan("m1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).payload.details?.retryAfterSeconds).toBe(90);
  });

  describe("expired session", () => {
    const unauthenticated = () =>
      new Response(
        JSON.stringify({
          statusCode: 401,
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        }),
        { status: 401 },
      );

    it("tells the registered handler when a signed-in request is refused with 401", async () => {
      const handler = vi.fn();
      const off = onUnauthenticated(handler);
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(unauthenticated())),
      );

      await expect(api.workspaces()).rejects.toBeInstanceOf(ApiError);

      expect(handler).toHaveBeenCalledTimes(1);
      off();
    });

    it("leaves the sign-in calls alone, because a wrong password is also a 401", async () => {
      const handler = vi.fn();
      const off = onUnauthenticated(handler);
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(unauthenticated())),
      );

      await expect(api.me()).rejects.toBeInstanceOf(ApiError);
      await expect(api.login("a@b.co", "wrong-password-123")).rejects.toBeInstanceOf(ApiError);

      expect(handler).not.toHaveBeenCalled();
      off();
    });

    it("ignores other errors and stops calling a handler that was removed", async () => {
      const handler = vi.fn();
      const off = onUnauthenticated(handler);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify({ statusCode: 403, code: "FORBIDDEN", message: "No" }), {
            status: 403,
          }),
        ),
      );
      await expect(api.workspaces()).rejects.toBeInstanceOf(ApiError);
      expect(handler).not.toHaveBeenCalled();

      off();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(unauthenticated())),
      );
      await expect(api.workspaces()).rejects.toBeInstanceOf(ApiError);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
