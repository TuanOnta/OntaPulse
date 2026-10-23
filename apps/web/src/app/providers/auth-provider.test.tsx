import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import { api } from "@/shared/api/client";

import { AuthProvider, useAuth } from "./auth-provider";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const expired = () =>
  json(401, { statusCode: 401, code: "UNAUTHENTICATED", message: "Authentication required" });

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function Screen() {
  const { user } = useAuth();
  return (
    <>
      <p>{user ? `Signed in as ${user.name}` : "Signed out"}</p>
      <button onClick={() => void api.workspaces().catch(() => undefined)} type="button">
        Load
      </button>
      <Where />
    </>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Routes>
          <Route element={<Screen />} path="/dashboard" />
          <Route element={<Screen />} path="/login" />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AuthProvider session expiry", () => {
  beforeEach(() => {
    toasts.error.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the user to sign in with one toast when a request finds the session expired", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith("/auth/me")
            ? json(200, { user: { id: "u1", name: "Dzaki", email: "d@x.dev" } })
            : expired(),
        ),
      ),
    );
    renderApp();
    expect(await screen.findByText("Signed in as Dzaki")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Load" }));
    await user.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/login"));
    expect(screen.getByText("Signed out")).toBeVisible();
    expect(toasts.error).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith("Your session expired. Sign in again.");
  });

  it("does nothing for a visitor who was never signed in", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(expired())),
    );
    renderApp();
    expect(await screen.findByText("Signed out")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(toasts.error).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });
});
