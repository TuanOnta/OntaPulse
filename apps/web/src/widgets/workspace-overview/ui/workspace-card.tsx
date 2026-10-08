import { useMemo } from "react";
import { Link } from "react-router-dom";

import { formatAge, initials, workspaceLook, type WorkspaceTone } from "@/entities/workspace";
import { formatDay } from "@/shared/lib/format";
import { resetTilt, trackSpotlight } from "@/shared/lib/pointer-spotlight";
import type { Workspace } from "@/shared/types/domain";
import { cn } from "cn";

import { riseStyle } from "./rise";
import { WorkspaceCover } from "./workspace-cover";

/** Tone colour handed to the card as `--t`; every tinted part of the card derives from it. */
export const TONE_VAR: Record<WorkspaceTone, string> = {
  info: "[--t:var(--color-landing-info)]",
  text: "[--t:var(--color-landing-text)]",
  warn: "[--t:var(--color-landing-warn)]",
  accent: "[--t:var(--color-landing-accent)]",
};

/**
 * Shared card chrome (workspace and create cards): tilt and lift on hover, tone glow, pointer
 * spotlight. The entrance animation uses `backwards` fill so it does not pin `transform: none` and
 * block the hover transform afterwards.
 */
export const CARD_CLASS = cn(
  "group relative flex animate-dash-rise flex-col overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/[.78] [--t:var(--color-landing-info)] [animation-fill-mode:backwards]",
  "[transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] transition-[transform,border-color,box-shadow] duration-[250ms] ease-out",
  "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),rgb(232_241_236/0.07),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 before:content-[''] hover:before:opacity-100",
  "hover:[transform:translateY(-4px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] hover:border-[color-mix(in_srgb,var(--t)_35%,transparent)] hover:shadow-[0_28px_56px_-26px_rgb(0_0_0/0.85),0_0_40px_-14px_color-mix(in_srgb,var(--t)_35%,transparent)]",
  "motion-reduce:animate-none motion-reduce:transition-none motion-reduce:[transform:none!important]",
);

export const STRETCH_LINK_CLASS =
  "absolute inset-0 z-[2] rounded-[inherit] focus-visible:outline-offset-[-3px]";

export function WorkspaceCard({ workspace, index }: { workspace: Workspace; index: number }) {
  const look = useMemo(() => workspaceLook(workspace), [workspace]);
  const age = formatAge(workspace.createdAt);

  return (
    <article
      className={cn(CARD_CLASS, TONE_VAR[look.tone], "workspace-card")}
      onPointerLeave={resetTilt}
      onPointerMove={trackSpotlight}
      style={riseStyle(index + 4)}
    >
      <WorkspaceCover glowDelay={look.glowDelay} role={workspace.role} wave={look.wave} />
      <div className="relative flex flex-1 flex-col gap-3.5 px-[22px] pb-5">
        {/* Opaque base under the tinted gradient, so the banner waveform never shows through the avatar. */}
        <div
          aria-hidden="true"
          className="-mt-[26px] grid size-[52px] place-items-center rounded-2xl border border-[color-mix(in_srgb,var(--t)_45%,transparent)] [background:linear-gradient(145deg,color-mix(in_srgb,var(--t)_22%,transparent),var(--color-landing-bg-2)),var(--color-landing-bg-2)] font-display text-[19px] leading-[normal] font-bold text-landing-text shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)] transition-transform duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] [transform:translateZ(24px)] group-hover:[transform:translateZ(24px)_scale(1.06)_rotate(-3deg)] motion-reduce:transition-none motion-reduce:[transform:none!important]"
        >
          {initials(workspace.name)}
        </div>
        <div>
          <h3 className="font-display text-[22px] leading-[1.2] font-bold tracking-[-.01em] [overflow-wrap:anywhere]">
            {workspace.name}
          </h3>
          <p className="mt-1 flex items-center gap-2 font-mono text-[14px] leading-[normal] text-landing-muted">
            <span>Created {formatDay(workspace.createdAt)}</span>
            {age ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-[3px] rounded-full bg-landing-border-strong"
                />
                <span>{age}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-landing-border pt-3.5 text-[15px] font-medium text-landing-text-2">
          <span>
            Open workspace
            {workspace.role ? (
              <span className="sr-only"> ({workspace.role.toLowerCase()})</span>
            ) : null}
          </span>
          <span
            aria-hidden="true"
            className="inline-block text-landing-muted transition-[transform,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-1.5 group-hover:text-landing-accent motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          >
            →
          </span>
        </div>
      </div>
      <Link
        aria-label={`Open workspace ${workspace.name}`}
        className={STRETCH_LINK_CLASS}
        to={`/workspaces/${workspace.id}`}
      />
    </article>
  );
}
