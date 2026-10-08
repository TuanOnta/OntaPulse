import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return {
    ...original,
    api: { addWorkspaceMember: mocks.add, removeWorkspaceMember: mocks.remove },
  };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { MembersPane, validateEmail, type MembersPaneProps } from "./members-pane";

const member = (id: string, name: string, role: WorkspaceRole): WorkspaceMember => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.com`,
  role,
  joinedAt: "2026-03-04T08:12:00Z",
});

const MEMBERS = [
  member("u1", "Dzaki", "OWNER"),
  member("u2", "Dimas", "ADMIN"),
  member("u3", "Rina", "MEMBER"),
];

const handlers = { onReload: vi.fn(), onAdded: vi.fn(), onChanged: vi.fn(), onRemoved: vi.fn() };

function setup(role: WorkspaceRole, over: Partial<MembersPaneProps> = {}) {
  return render(
    <MembersPane
      currentUserId="u1"
      error={null}
      members={MEMBERS}
      role={role}
      status="ready"
      workspaceId="w1"
      {...handlers}
      {...over}
    />,
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  Object.values(handlers).forEach((mock) => mock.mockReset());
});

describe("validateEmail", () => {
  it("covers empty, invalid, too long and duplicate", () => {
    expect(validateEmail("", [])).toBe("Enter an email address.");
    expect(validateEmail("nope", [])).toBe("Enter a valid email address.");
    expect(validateEmail(`${"a".repeat(320)}@x.io`, [])).toBe("Enter a valid email address.");
    expect(validateEmail("a@b.co", ["a@b.co"])).toBe("This person is already a member.");
    expect(validateEmail("a@b.co", [])).toBeNull();
  });
});

describe("MembersPane permissions", () => {
  it("OWNER can add, change roles and remove others, but not the owner row", () => {
    setup("OWNER");
    expect(screen.getByLabelText("Add a registered user")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for Dimas" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for Rina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Dimas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Dzaki" })).not.toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("ADMIN can add and remove members only, with no role select", () => {
    setup("ADMIN", { currentUserId: "u2" });
    expect(screen.getByLabelText("Add a registered user")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Rina" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Dimas" })).not.toBeInTheDocument();
  });

  it("MEMBER gets a view-only note and no controls", () => {
    setup("MEMBER", { currentUserId: "u3" });
    expect(screen.getByText("Only owners and admins can add or remove members.")).toBeVisible();
    expect(screen.queryByLabelText("Add a registered user")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });
});

describe("MembersPane actions", () => {
  it("adds a member by email and reports it", async () => {
    const user = userEvent.setup();
    const added = member("u9", "Newbie", "MEMBER");
    mocks.add.mockResolvedValue(added);
    setup("OWNER");
    await user.type(screen.getByLabelText("Add a registered user"), " Newbie@Example.com ");
    await user.click(screen.getByRole("button", { name: "Add member" }));
    await waitFor(() => expect(handlers.onAdded).toHaveBeenCalledWith(added));
    expect(mocks.add).toHaveBeenCalledWith("w1", "newbie@example.com");
  });

  it("shows the API message inline when the user is unknown", async () => {
    const user = userEvent.setup();
    mocks.add.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "No registered user with this email.",
      }),
    );
    setup("OWNER");
    await user.type(screen.getByLabelText("Add a registered user"), "who@example.com");
    await user.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByText("No registered user with this email.")).toBeVisible();
    expect(handlers.onAdded).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email without calling the API", async () => {
    const user = userEvent.setup();
    setup("OWNER");
    await user.type(screen.getByLabelText("Add a registered user"), "rina@example.com");
    await user.click(screen.getByRole("button", { name: "Add member" }));
    expect(screen.getByText("This person is already a member.")).toBeVisible();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("confirms before removing a member", async () => {
    const user = userEvent.setup();
    mocks.remove.mockResolvedValue(undefined);
    setup("OWNER");
    await user.click(screen.getByRole("button", { name: "Remove Rina" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Rina will lose access/)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("w1", "u3"));
    await waitFor(() => expect(handlers.onRemoved).toHaveBeenCalledWith("u3"));
  });
});

describe("MembersPane states", () => {
  it("shows the error row with a retry", async () => {
    const user = userEvent.setup();
    setup("OWNER", {
      status: "error",
      members: [],
      error: { message: "Down", requestId: "req-1" },
    });
    expect(screen.getByText(/Request ID: req-1/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(handlers.onReload).toHaveBeenCalledOnce();
  });
});
