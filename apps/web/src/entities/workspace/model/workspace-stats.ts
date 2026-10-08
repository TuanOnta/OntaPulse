import type { Workspace, WorkspaceRole } from "@/shared/types/domain";

export type RoleFilter = "ALL" | WorkspaceRole;

export const ROLE_FILTERS: readonly RoleFilter[] = ["ALL", "OWNER", "ADMIN", "MEMBER"];

export const ROLE_LABEL: Record<RoleFilter, string> = {
  ALL: "All",
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export type WorkspaceSummary = { total: number; owned: number; shared: number };

/** Dashboard counts, derived from the workspace list only (the API has no other aggregates). */
export function summarizeWorkspaces(workspaces: readonly Workspace[]): WorkspaceSummary {
  const owned = workspaces.filter((workspace) => workspace.role === "OWNER").length;
  return { total: workspaces.length, owned, shared: workspaces.length - owned };
}

export function countByRole(workspaces: readonly Workspace[]): Record<RoleFilter, number> {
  const counts: Record<RoleFilter, number> = {
    ALL: workspaces.length,
    OWNER: 0,
    ADMIN: 0,
    MEMBER: 0,
  };
  for (const workspace of workspaces) if (workspace.role) counts[workspace.role]++;
  return counts;
}

/** Role chip and search box combine; the search is a case-insensitive substring match on the name. */
export function filterWorkspaces(
  workspaces: readonly Workspace[],
  role: RoleFilter,
  query: string,
): Workspace[] {
  const needle = query.trim().toLowerCase();
  return workspaces.filter(
    (workspace) =>
      (role === "ALL" || workspace.role === role) && workspace.name.toLowerCase().includes(needle),
  );
}

/** Up to two initials from the first letters or digits of the first two words ("W" when none). */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => Array.from(word).find((char) => /[\p{L}\p{N}]/u.test(char)))
    .filter((char): char is string => Boolean(char))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "W";
}

export function firstName(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}
