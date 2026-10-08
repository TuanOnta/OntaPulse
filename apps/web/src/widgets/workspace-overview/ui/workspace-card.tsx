import { Link } from "react-router-dom";

import { WorkspaceRoleBadge, initials } from "@/entities/workspace";
import { formatDay } from "@/shared/lib/format";
import { trackSpotlight } from "@/shared/lib/pointer-spotlight";
import type { Workspace } from "@/shared/types/domain";

import { riseStyle } from "./rise";

export const CARD_CLASS =
  "group relative flex min-h-[176px] animate-dash-rise flex-col gap-[18px] overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/[.78] p-[22px] transition-[transform,border-color,box-shadow] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),rgb(232_241_236/0.07),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-landing-border-strong hover:shadow-[0_24px_50px_-24px_rgb(0_0_0/0.8)] hover:before:opacity-100 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export const STRETCH_LINK_CLASS =
  "absolute inset-0 z-[2] rounded-[inherit] focus-visible:outline-offset-[-3px]";

export function WorkspaceCard({ workspace, index }: { workspace: Workspace; index: number }) {
  return (
    <article className={CARD_CLASS} onPointerMove={trackSpotlight} style={riseStyle(index + 4)}>
      <div className="flex items-start justify-between gap-3">
        <div
          aria-hidden="true"
          className="grid size-[46px] flex-none place-items-center rounded-[14px] border border-landing-border-strong bg-[linear-gradient(145deg,var(--color-landing-surface-2),var(--color-landing-bg-2))] font-display text-[19px] leading-[normal] font-bold text-landing-text"
        >
          {initials(workspace.name)}
        </div>
        {workspace.role ? <WorkspaceRoleBadge role={workspace.role} /> : null}
      </div>
      <div>
        <h3 className="font-display text-[22px] leading-[1.2] font-bold tracking-[-.01em] [overflow-wrap:anywhere]">
          {workspace.name}
        </h3>
        <p className="mt-1 font-mono text-[14px] leading-[normal] text-landing-muted">
          Created {formatDay(workspace.createdAt)}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between text-[15px] font-medium text-landing-text-2">
        <span>Open workspace</span>
        <span
          aria-hidden="true"
          className="inline-block text-landing-muted transition-[transform,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-1.5 group-hover:text-landing-accent motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      </div>
      <Link
        aria-label={`Open workspace ${workspace.name}`}
        className={STRETCH_LINK_CLASS}
        to={`/workspaces/${workspace.id}`}
      />
    </article>
  );
}
