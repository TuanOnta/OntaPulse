import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";

function setup() {
  const onSubmit = vi.fn();
  const onInvalid = vi.fn();
  render(<RegisterForm busy={false} onInvalid={onInvalid} onSubmit={onSubmit} />);
  return { onSubmit, onInvalid, user: userEvent.setup() };
}

describe("RegisterForm", () => {
  it("rejects a short name, bad email and short password without submitting", async () => {
    const { onSubmit, onInvalid, user } = setup();
    await user.type(screen.getByLabelText("Name"), "A");
    await user.type(screen.getByLabelText("Email"), "person");
    await user.type(screen.getByLabelText("Password"), "short-pass");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalled();
    expect(screen.getByText("Enter your name (2 to 80 characters).")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 12 characters.")).toBeInTheDocument();
  });

  it("shows the live password rule and count as text", async () => {
    const { user } = setup();
    expect(screen.getByText("At least 12 characters")).toBeInTheDocument();
    expect(screen.getByText("0 / 128")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Password"), "twelve-chars");
    expect(screen.getByText("✓ Long enough")).toBeInTheDocument();
    expect(screen.getByText("12 / 128")).toBeInTheDocument();
  });

  it("submits valid values unchanged", async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText("Name"), "Person");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Person",
      email: "person@example.com",
      password: "correct-horse-battery",
    });
  });
});
