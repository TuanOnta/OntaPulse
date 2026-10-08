import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  auth: { user: null as null | { id: string }, isLoading: false },
}));

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    login: mocks.login,
    register: mocks.register,
    user: mocks.auth.user,
    isLoading: mocks.auth.isLoading,
  }),
}));

import { AuthPage } from "./auth-page";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

/** The visible view: both views stay mounted, the inactive one is hidden. */
function view() {
  return within(screen.getByRole("tabpanel"));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AuthPage />}>
          <Route element={null} path="/login" />
          <Route element={null} path="/register" />
        </Route>
        <Route element={<p>Dashboard</p>} path="/dashboard" />
        <Route element={<p>Landing</p>} path="/" />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  mocks.auth.user = null;
  mocks.auth.isLoading = false;
  mocks.login.mockReset();
  mocks.register.mockReset();
});

afterEach(() => {
  cleanup(); // unmount (cancels the scene import) before the globals are restored
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AuthPage", () => {
  it("opens the tab that matches the URL", () => {
    renderAt("/register");
    expect(screen.getByRole("tab", { name: "Create account" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });

  it("switches tabs by updating the URL, with the keyboard too", async () => {
    const user = userEvent.setup();
    renderAt("/login");
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Create account" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/register");
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeVisible();

    screen.getByRole("tab", { name: "Create account" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("where")).toHaveTextContent("/login");
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveFocus();
  });

  it("links back to the landing page", () => {
    renderAt("/login");
    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute("href", "/");
  });

  it("does not call the API when the form is invalid", async () => {
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(view().getByRole("button", { name: "Sign in" }));
    expect(mocks.login).not.toHaveBeenCalled();
    expect(view().getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("shows the API message and request id in the banner when sign-in fails", async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue(
      new ApiError({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
        requestId: "req-42",
      }),
    );
    renderAt("/login");
    await user.type(view().getByLabelText("Email"), "person@example.com");
    await user.type(view().getByLabelText("Password"), "wrong");
    await user.click(view().getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
    expect(alert).toHaveTextContent("Request ID: req-42");
    expect(view().getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("uses a generic message for non-API errors", async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue(new Error("boom: secret details"));
    renderAt("/login");
    await user.type(view().getByLabelText("Email"), "person@example.com");
    await user.type(view().getByLabelText("Password"), "x");
    await user.click(view().getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Try again.");
    expect(alert).not.toHaveTextContent("secret");
  });

  it("shows the success view first, then goes to the dashboard", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // AuthProvider sets the user as soon as the request resolves.
    mocks.register.mockImplementation(async () => {
      mocks.auth.user = { id: "user-1" };
    });
    renderAt("/register");
    await user.type(view().getByLabelText("Name"), "Person");
    await user.type(view().getByLabelText("Email"), "person@example.com");
    await user.type(view().getByLabelText("Password"), "correct-horse-battery");
    await user.click(view().getByRole("button", { name: "Create account" }));

    expect(mocks.register).toHaveBeenCalledWith(
      "Person",
      "person@example.com",
      "correct-horse-battery",
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Your workspace is ready.");
    expect(screen.getByTestId("where")).toHaveTextContent("/register");

    act(() => {
      vi.advanceTimersByTime(2700);
    });
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
  });

  it("sends an already signed-in visitor straight to the dashboard", () => {
    mocks.auth.user = { id: "user-1" };
    renderAt("/login");
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });
});
