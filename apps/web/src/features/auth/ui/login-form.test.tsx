import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

function setup(props: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const onSubmit = vi.fn();
  const onInvalid = vi.fn();
  render(<LoginForm busy={false} onInvalid={onInvalid} onSubmit={onSubmit} {...props} />);
  return { onSubmit, onInvalid, user: userEvent.setup() };
}

describe("LoginForm", () => {
  it("shows inline errors, focuses the first invalid field and does not submit", async () => {
    const { onSubmit, onInvalid, user } = setup();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("submits the entered values", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSubmit).toHaveBeenCalledWith({ email: "person@example.com", password: "x" });
  });

  it("validates a field on blur and clears the error once it is fixed", async () => {
    const { user } = setup();
    const email = screen.getByLabelText("Email");
    await user.type(email, "nope");
    await user.tab();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

    await user.type(email, "@example.com");
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
    expect(email).not.toHaveAttribute("aria-invalid");
  });

  it("does not complain about an untouched field on blur", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Email"));
    await user.tab();
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("disables the submit button and announces the busy state", () => {
    setup({ busy: true });
    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
