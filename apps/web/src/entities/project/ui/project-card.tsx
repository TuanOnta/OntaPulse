import { Link } from "react-router-dom";

import { riseStyle } from "@/shared/lib/rise";
import { formatDay } from "@/shared/lib/format";
import { trackPointer } from "@/shared/lib/pointer-spotlight";
import type { Project } from "@/shared/types/domain";

const FolderIcon = () => (
  <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 22 22" width="22">
    <path
      d="M3 6.5 A2 2 0 0 1 5 4.5 H8.6 L10.6 6.8 H17 A2 2 0 0 1 19 8.8 V15.5 A2 2 0 0 1 17 17.5 H5 A2 2 0 0 1 3 15.5 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

/** Project tile with a pointer spotlight. The whole card is one stretched link. */
export function ProjectCard({
  project,
  workspaceId,
  index,
}: {
  project: Project;
  workspaceId: string;
  index: number;
}) {
  return (
    <article
      className="group relative flex min-h-[184px] animate-dash-rise flex-col gap-3.5 overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/[.78] p-[22px] transition-[transform,border-color,box-shadow] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] [animation-fill-mode:backwards] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),rgb(232_241_236/0.07),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 before:content-[''] hover:-translate-y-1 hover:border-landing-border-strong hover:shadow-[0_24px_50px_-26px_rgb(0_0_0/0.85)] hover:before:opacity-100 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onPointerMove={trackPointer}
      style={riseStyle(index)}
    >
      <div className="grid size-11 place-items-center rounded-[13px] border border-landing-border-strong bg-[linear-gradient(145deg,var(--color-landing-surface-2),var(--color-landing-bg-2))] text-landing-text-2 transition-colors duration-300 group-hover:border-landing-muted group-hover:text-landing-text">
        <FolderIcon />
      </div>
      <div>
        <h3 className="font-display text-[21px] leading-[1.2] font-bold tracking-[-.01em] [overflow-wrap:anywhere]">
          {project.name}
        </h3>
        {project.description ? (
          <p className="mt-1.5 line-clamp-2 text-[15px] text-landing-muted">
            {project.description}
          </p>
        ) : (
          <p className="mt-1.5 text-[15px] text-landing-muted italic opacity-70">No description</p>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-landing-border pt-3.5 font-mono text-[14px] leading-[normal] text-landing-muted">
        <span>Created {formatDay(project.createdAt)}</span>
        <span
          aria-hidden="true"
          className="inline-block font-body text-[16px] transition-[transform,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-1.5 group-hover:text-landing-accent motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      </div>
      <Link
        aria-label={`Open project ${project.name}`}
        className="absolute inset-0 z-[2] rounded-[inherit] focus-visible:outline-offset-[-3px]"
        to={`/workspaces/${workspaceId}/projects/${project.id}`}
      />
    </article>
  );
}
