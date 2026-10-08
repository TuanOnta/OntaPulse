import { cn } from "cn";

import { initials } from "../model/workspace-stats";

/** Round initials badge for a person (member list). */
export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid size-[42px] flex-none place-items-center rounded-full border border-landing-border-strong bg-[linear-gradient(135deg,var(--color-landing-surface-2),var(--color-landing-border-strong))] font-display text-[15px] leading-[normal] font-bold",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
