import type { WorkspaceMember, WorkspaceRole } from "@/shared/types/domain";

/**
 * UI mirror of the capability table in AGENTS.md section 10. These helpers only hide or disable
 * actions; the API still decides.
 */

const ROLE_RANK: Record<WorkspaceRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

/** OWNER and ADMIN create projects and add members. */
export function canManageWorkspace(role?: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Only the OWNER changes roles, never their own and never another OWNER's. */
export function canChangeRole(
  myRole: WorkspaceRole | undefined,
  target: Pick<WorkspaceMember, "role">,
  isSelf: boolean,
): boolean {
  return myRole === "OWNER" && target.role !== "OWNER" && !isSelf;
}

/** OWNER removes ADMIN and MEMBER; ADMIN removes MEMBER only; nobody removes the OWNER or self. */
export function canRemoveMember(
  myRole: WorkspaceRole | undefined,
  target: Pick<WorkspaceMember, "role">,
  isSelf: boolean,
): boolean {
  if (isSelf || target.role === "OWNER") return false;
  return myRole === "OWNER" || (myRole === "ADMIN" && target.role === "MEMBER");
}

/** OWNER first, then ADMIN, then MEMBER, then by name. Returns a new array. */
export function sortMembers<T extends Pick<WorkspaceMember, "role" | "name">>(members: T[]): T[] {
  return [...members].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name),
  );
}
