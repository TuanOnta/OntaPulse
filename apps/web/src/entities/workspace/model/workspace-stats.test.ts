import { describe, expect, it } from "vitest";

import type { Workspace } from "@/shared/types/domain";

import {
  countByRole,
  filterWorkspaces,
  firstName,
  initials,
  summarizeWorkspaces,
} from "./workspace-stats";

const make = (name: string, role?: Workspace["role"]): Workspace => ({
  id: name,
  name,
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});

const LIST = [
  make("MrScraper Platform", "OWNER"),
  make("Personal projects", "OWNER"),
  make("Client — Glam by Qody", "ADMIN"),
  make("Open-source status pages", "MEMBER"),
];

describe("summarizeWorkspaces", () => {
  it("counts owned and shared workspaces", () => {
    expect(summarizeWorkspaces(LIST)).toEqual({ total: 4, owned: 2, shared: 2 });
    expect(summarizeWorkspaces([])).toEqual({ total: 0, owned: 0, shared: 0 });
  });

  it("treats a workspace without a role as shared", () => {
    expect(summarizeWorkspaces([make("No role")])).toEqual({ total: 1, owned: 0, shared: 1 });
  });
});

describe("countByRole", () => {
  it("counts per role and in total", () => {
    expect(countByRole(LIST)).toEqual({ ALL: 4, OWNER: 2, ADMIN: 1, MEMBER: 1 });
  });
});

describe("filterWorkspaces", () => {
  it("filters by role", () => {
    expect(filterWorkspaces(LIST, "ADMIN", "").map((w) => w.name)).toEqual([
      "Client — Glam by Qody",
    ]);
  });

  it("searches case-insensitively on the name", () => {
    expect(filterWorkspaces(LIST, "ALL", "  PROJ ").map((w) => w.name)).toEqual([
      "Personal projects",
    ]);
  });

  it("combines role and search, and can return nothing", () => {
    expect(filterWorkspaces(LIST, "OWNER", "client")).toEqual([]);
  });
});

describe("initials", () => {
  it("uses the first letter of the first two words", () => {
    expect(initials("MrScraper Platform")).toBe("MP");
    expect(initials("single")).toBe("S");
    expect(initials("one two three")).toBe("OT");
  });

  it("skips words that start with punctuation and falls back to W", () => {
    expect(initials("Client — Glam by Qody")).toBe("CG");
    expect(initials("— …")).toBe("W");
  });

  it("handles non-latin letters", () => {
    expect(initials("日本 監視")).toBe("日監");
  });
});

describe("firstName", () => {
  it("returns the first word of the name", () => {
    expect(firstName("Dzaki Arta")).toBe("Dzaki");
    expect(firstName("  Solo ")).toBe("Solo");
    expect(firstName(undefined)).toBe("");
  });
});
