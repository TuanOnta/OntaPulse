import { cn } from "cn";

import type { WorkspaceRole } from "@/shared/types/domain";

const ROLE_STYLE: Record<WorkspaceRole, string> = {
  OWNER: "bg-landing-text/[.06] text-landing-text",
  ADMIN: "bg-landing-info/[.08] text-landing-info",
  MEMBER: "bg-landing-muted/[.06] text-landing-muted",
};

const ICON_PROPS = { "aria-hidden": true, className: "size-3", fill: "none", viewBox: "0 0 12 12" };

function RoleIcon({ role }: { role: WorkspaceRole }) {
  if (role === "OWNER") {
    return (
      <svg {...ICON_PROPS}>
        <path
          d="M1.5 9 L1 3.5 L4 6 L6 2.5 L8 6 L11 3.5 L10.5 9 Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      </svg>
    );
  }
  if (role === "ADMIN") {
    return (
      <svg {...ICON_PROPS}>
        <path
          d="M6 1.2 L10.2 2.8 V6 C10.2 8.4 8.4 10 6 10.8 C3.6 10 1.8 8.4 1.8 6 V2.8 Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS}>
      <circle cx="6" cy="4" r="2.1" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M2 10.4 C2.5 8.4 4 7.6 6 7.6 S9.5 8.4 10 10.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/** Role pill with an icon. The role is spelled out as text, so it never relies on colour alone. */
export function WorkspaceRoleBadge({
  role,
  className,
}: {
  role: WorkspaceRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-[5px] font-mono text-[12px] leading-[normal] font-medium tracking-[.06em] uppercase",
        ROLE_STYLE[role],
        className,
      )}
    >
      <RoleIcon role={role} />
      {role}
    </span>
  );
}
