import { WorkspaceRoleBadge } from "@/entities/workspace";
import type { WorkspaceRole } from "@/shared/types/domain";

/** Banner at the top of a card: tinted gradient, dot grid, role pill and the workspace waveform. */
export function WorkspaceCover({
  role,
  wave,
  glowDelay,
}: {
  role?: WorkspaceRole;
  wave: string;
  glowDelay: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[104px] overflow-hidden border-b border-landing-border bg-[radial-gradient(120%_140%_at_15%_0%,color-mix(in_srgb,var(--t)_20%,transparent),transparent_60%),linear-gradient(180deg,color-mix(in_srgb,var(--t)_6%,transparent),transparent)] before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_srgb,var(--t)_28%,transparent)_1px,transparent_1.2px)] before:[background-size:14px_14px] before:[mask-image:linear-gradient(180deg,#000,transparent_85%)] before:transition-[background-position] before:duration-[800ms] before:ease-out before:content-[''] group-hover:before:[background-position:14px_7px] motion-reduce:before:transition-none"
    >
      {role ? (
        <WorkspaceRoleBadge
          className="absolute top-3.5 right-3.5 z-[1] bg-landing-bg/60 backdrop-blur-[6px]"
          role={role}
        />
      ) : null}
      <svg
        className="absolute inset-x-0 bottom-0 block h-[72px] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 400 72"
      >
        <path
          className="fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6] [stroke:color-mix(in_srgb,var(--t)_75%,transparent)] [vector-effect:non-scaling-stroke]"
          d={wave}
        />
        <path
          className="animate-dash-wave fill-none [filter:drop-shadow(0_0_5px_var(--t))] [stroke-dasharray:60_1000] [stroke-dashoffset:60] [stroke-linecap:round] [stroke-width:2.4] [stroke:var(--t)] [vector-effect:non-scaling-stroke] group-hover:[animation-duration:2.2s] motion-reduce:animate-none"
          d={wave}
          style={{ animationDelay: `${glowDelay}s` }}
        />
      </svg>
    </div>
  );
}
