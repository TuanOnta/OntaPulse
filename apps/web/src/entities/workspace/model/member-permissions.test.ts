import { describe, expect, it } from "vitest";

import {
  canChangeRole,
  canManageWorkspace,
  canRemoveMember,
  sortMembers,
} from "./member-permissions";

describe("member permissions", () => {
  it("lets only OWNER and ADMIN manage the workspace", () => {
    expect(canManageWorkspace("OWNER")).toBe(true);
    expect(canManageWorkspace("ADMIN")).toBe(true);
    expect(canManageWorkspace("MEMBER")).toBe(false);
    expect(canManageWorkspace(undefined)).toBe(false);
  });

  it("lets only the OWNER change the role of another non-owner", () => {
    expect(canChangeRole("OWNER", { role: "ADMIN" }, false)).toBe(true);
    expect(canChangeRole("OWNER", { role: "MEMBER" }, false)).toBe(true);
    expect(canChangeRole("OWNER", { role: "OWNER" }, false)).toBe(false);
    expect(canChangeRole("OWNER", { role: "MEMBER" }, true)).toBe(false);
    expect(canChangeRole("ADMIN", { role: "MEMBER" }, false)).toBe(false);
    expect(canChangeRole("MEMBER", { role: "MEMBER" }, false)).toBe(false);
  });

  it("follows the removal rules", () => {
    expect(canRemoveMember("OWNER", { role: "ADMIN" }, false)).toBe(true);
    expect(canRemoveMember("OWNER", { role: "MEMBER" }, false)).toBe(true);
    expect(canRemoveMember("ADMIN", { role: "MEMBER" }, false)).toBe(true);
    expect(canRemoveMember("ADMIN", { role: "ADMIN" }, false)).toBe(false);
    expect(canRemoveMember("MEMBER", { role: "MEMBER" }, false)).toBe(false);
    expect(canRemoveMember("OWNER", { role: "OWNER" }, false)).toBe(false);
    expect(canRemoveMember("OWNER", { role: "MEMBER" }, true)).toBe(false);
  });

  it("sorts by role then name without mutating the input", () => {
    const input = [
      { name: "Zed", role: "MEMBER" as const },
      { name: "Bea", role: "ADMIN" as const },
      { name: "Amy", role: "MEMBER" as const },
      { name: "Cy", role: "OWNER" as const },
    ];
    expect(sortMembers(input).map((m) => m.name)).toEqual(["Cy", "Bea", "Amy", "Zed"]);
    expect(input[0].name).toBe("Zed");
  });
});
