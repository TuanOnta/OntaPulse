import { cn } from "cn";

import type { WorkspaceRole } from "@/shared/types/domain";

const ROLE_STYLE: Record<WorkspaceRole, string> = {
  OWNER: "bg-landing-text/[.06] text-landing-text",
  ADMIN: "bg-landing-info/[.08] text-landing-info",
  MEMBER: "bg-landing-muted/[.06] text-landing-muted",
};

/** Role pill. The role is spelled out as text, so it never relies on colour alone. */
export function WorkspaceRoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <span
      className={cn(
        "rounded-full border border-current px-2.5 py-[5px] font-mono text-[12px] leading-[normal] font-medium tracking-[.06em] uppercase",
        ROLE_STYLE[role],
      )}
    >
      {role}
    </span>
  );
}
