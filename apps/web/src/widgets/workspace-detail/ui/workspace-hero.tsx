import type { ReactNode } from "react";

import {
  TONE_VAR,
  WAVE_VIEW,
  WorkspaceRoleBadge,
  initials,
  type WorkspaceTone,
} from "@/entities/workspace";
import { LockIcon } from "@/features/workspaces/members-pane";
import { formatDay } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";
import type { WorkspaceRole } from "@/shared/types/domain";
import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";

const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export type WorkspaceHeroProps = {
  name: string;
  createdAt: string;
  role?: WorkspaceRole;
  wave: string;
  /** Same tone as the workspace card on the dashboard. */
  tone: WorkspaceTone;
  memberCount: number | null;
  projectCount: number | null;
  canManage: boolean;
  onNewProject: () => void;
  onAddMember: () => void;
};

/** Cover with the workspace waveform, avatar mark, name, meta line and the primary actions. */
export function WorkspaceHero({
  name,
  createdAt,
  role,
  wave,
  tone,
  memberCount,
  projectCount,
  canManage,
  onNewProject,
  onAddMember,
}: WorkspaceHeroProps) {
  const meta: ReactNode[] = [`Created ${formatDay(createdAt)}`];
  if (memberCount !== null) meta.push(pluralize(memberCount, "member"));
  if (projectCount !== null) meta.push(pluralize(projectCount, "project"));

  return (
    <header
      className={`relative animate-dash-rise overflow-hidden rounded-[26px] border border-landing-border bg-landing-surface/[.78] motion-reduce:animate-none ${TONE_VAR[tone]}`}
      style={riseStyle(1)}
    >
      <div
        aria-hidden="true"
        className="relative h-[132px] overflow-hidden border-b border-landing-border bg-[radial-gradient(120%_140%_at_12%_0%,color-mix(in_srgb,var(--t)_20%,transparent),transparent_60%),linear-gradient(180deg,color-mix(in_srgb,var(--t)_6%,transparent),transparent)] before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_srgb,var(--t)_28%,transparent)_1px,transparent_1.2px)] before:[background-size:14px_14px] before:[mask-image:linear-gradient(180deg,#000,transparent_85%)] before:content-['']"
      >
        {role ? (
          <WorkspaceRoleBadge
            className="absolute top-4 right-4 z-[1] bg-landing-bg/60 backdrop-blur-[6px]"
            role={role}
          />
        ) : null}
        <svg
          className="absolute inset-x-0 bottom-0 block h-[88px] w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${WAVE_VIEW.width} ${WAVE_VIEW.height}`}
        >
          <path
            className="fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6] [stroke:color-mix(in_srgb,var(--t)_75%,transparent)] [vector-effect:non-scaling-stroke]"
            d={wave}
          />
          <path
            className="animate-ws-glow fill-none [filter:drop-shadow(0_0_5px_var(--t))] [stroke-dasharray:80_1400] [stroke-dashoffset:80] [stroke-linecap:round] [stroke-width:2.4] [stroke:var(--t)] [vector-effect:non-scaling-stroke] motion-reduce:animate-none"
            d={wave}
          />
        </svg>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5 px-7 pb-[26px] max-[959px]:px-[18px] max-[959px]:pb-[22px]">
        <div className="flex min-w-0 items-end gap-[18px] max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-2.5">
          <div
            aria-hidden="true"
            className="-mt-9 grid size-[72px] flex-none place-items-center rounded-[22px] border border-[color-mix(in_srgb,var(--t)_45%,transparent)] [background:linear-gradient(145deg,color-mix(in_srgb,var(--t)_22%,transparent),var(--color-landing-bg-2)),var(--color-landing-bg-2)] font-display text-[26px] leading-[normal] font-bold text-landing-text shadow-[0_14px_30px_-12px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.08)]"
          >
            {initials(name)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(28px,3.4vw,40px)] leading-[1.08] font-bold tracking-[-.02em] [overflow-wrap:anywhere]">
              {name}
            </h1>
            <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[14px] leading-[normal] text-landing-muted">
              {meta.map((item, index) => (
                <span
                  className={
                    index > 0
                      ? "before:mr-3.5 before:text-landing-border-strong before:content-['·'] max-[520px]:before:hidden"
                      : ""
                  }
                  key={index}
                >
                  {item}
                </span>
              ))}
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2.5 max-[520px]:w-full">
            <ActionButton
              className="max-[520px]:flex-[1_1_140px] max-[520px]:px-4 max-[520px]:whitespace-nowrap"
              onClick={onAddMember}
              variant="ghost"
            >
              Add member
            </ActionButton>
            <ActionButton
              className="max-[520px]:flex-[1_1_140px] max-[520px]:px-4 max-[520px]:whitespace-nowrap"
              onClick={onNewProject}
            >
              <PlusIcon />
              New project
            </ActionButton>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-landing-border bg-landing-bg/50 px-3.5 py-2.5 text-[15px] text-landing-muted">
            <LockIcon />
            View-only access. Owners and admins manage projects and members.
          </div>
        )}
      </div>
    </header>
  );
}
