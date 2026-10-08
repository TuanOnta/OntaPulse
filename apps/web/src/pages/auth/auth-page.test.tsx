import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthPage } from "./auth-page";

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn(), user: null, isLoading: false }),
}));

describe("AuthPage", () => {
  it("opens the registration form on /register", () => {
    render(
      <MemoryRouter>
        <AuthPage initialMode="register" />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to OntaPulse/ })).toHaveAttribute("href", "/");
  });

  it("opens the login form on /login", () => {
    render(
      <MemoryRouter>
        <AuthPage initialMode="login" />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });
});
