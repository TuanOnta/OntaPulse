import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
  register: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({ login: mocks.login, register: mocks.register }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { LandingAuthPanel } from "./landing-auth-panel";

describe("LandingAuthPanel", () => {
  it("signs in and redirects after valid credentials are submitted", async () => {
    const user = userEvent.setup();
    mocks.login.mockResolvedValue(undefined);
    render(<LandingAuthPanel mode="login" onModeChange={() => {}} />);

    await user.type(screen.getByLabelText("Email address"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith(
        "person@example.com",
        "correct-horse-battery-staple",
      );
      expect(mocks.navigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("rejects a too-short registration password before calling the API", async () => {
    const user = userEvent.setup();
    render(<LandingAuthPanel mode="register" onModeChange={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Person");
    await user.type(screen.getByLabelText("Email address"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mocks.toastError).toHaveBeenCalledWith("Use a password of at least 12 characters.");
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
