import { Link } from "react-router-dom";

import { resetTilt, trackSpotlight } from "@/shared/lib/pointer-spotlight";

import { PlusIcon } from "./buttons";
import { riseStyle } from "./rise";
import { CARD_CLASS, STRETCH_LINK_CLASS } from "./workspace-card";
import { cn } from "cn";

/** Dashed "Create workspace" card, shown at the end of the grid when nothing is filtered. */
export function CreateWorkspaceCard({ index }: { index: number }) {
  return (
    <article
      className={cn(
        CARD_CLASS,
        "min-h-[260px] items-center justify-center gap-2.5 border-dashed border-landing-border-strong bg-transparent text-center text-landing-text-2",
      )}
      onPointerLeave={resetTilt}
      onPointerMove={trackSpotlight}
      style={riseStyle(index)}
    >
      <div className="grid size-[52px] place-items-center rounded-full border border-dashed border-landing-muted text-landing-text-2 transition-[transform,color,border-color] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-90 group-hover:border-landing-accent group-hover:text-landing-accent motion-reduce:transition-none motion-reduce:group-hover:rotate-0">
        <PlusIcon size={22} stroke={1.8} />
      </div>
      <strong className="font-display text-[19px] leading-[normal] font-bold text-landing-text">
        Create workspace
      </strong>
      <span className="text-[15px] text-landing-muted">Invite teammates and start monitoring.</span>
      <Link
        aria-label="Create a new workspace"
        className={STRETCH_LINK_CLASS}
        to="/workspaces/new"
      />
    </article>
  );
}
