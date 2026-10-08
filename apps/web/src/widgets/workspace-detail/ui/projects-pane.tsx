import { ProjectCard, type ProjectsError } from "@/entities/project";
import { riseStyle } from "@/shared/lib/rise";
import type { Project } from "@/shared/types/domain";
import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";
import { StateArt } from "@/shared/ui/state-art";

import {
  LoadErrorBanner,
  PANEL,
  PANEL_TEXT,
  PANEL_TITLE,
  ProjectsSkeleton,
} from "./workspace-states";

/** Index of the first project card in the entrance sequence (hero is 1, tabs are 2). */
const FIRST_CARD_RISE = 3;

export type ProjectsPaneProps = {
  workspaceId: string;
  status: "loading" | "ready" | "error";
  projects: Project[];
  error: ProjectsError | null;
  canManage: boolean;
  onNewProject: () => void;
  onReload: () => void;
};

/** Projects tab: card grid with a dashed "New project" card, or loading, empty and error states. */
export function ProjectsPane({
  workspaceId,
  status,
  projects,
  error,
  canManage,
  onNewProject,
  onReload,
}: ProjectsPaneProps) {
  return (
    <div>
      <div className="mb-[18px]">
        <h2 className="font-display text-[22px] font-bold tracking-[-.01em]">Projects</h2>
        <p className="mt-0.5 text-[15px] text-landing-muted">
          Each project holds the monitors you check together.
        </p>
      </div>
      {status === "loading" ? (
        <ProjectsSkeleton />
      ) : status === "error" ? (
        <LoadErrorBanner
          message={error?.message ?? ""}
          onRetry={onReload}
          requestId={error?.requestId}
          title="Couldn’t load projects."
        />
      ) : projects.length === 0 ? (
        <div className={PANEL}>
          <StateArt />
          <h2 className={PANEL_TITLE}>No projects yet</h2>
          <p className={PANEL_TEXT}>
            {canManage
              ? "Create a project, then add the first monitor to start scanning."
              : "An owner or admin needs to create the first project."}
          </p>
          {canManage ? (
            <div className="mt-2.5 flex flex-wrap justify-center gap-3">
              <ActionButton onClick={onNewProject}>
                <PlusIcon />
                New project
              </ActionButton>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 max-[520px]:grid-cols-[minmax(0,1fr)]">
          {projects.map((project, index) => (
            <ProjectCard
              index={index + FIRST_CARD_RISE}
              key={project.id}
              project={project}
              workspaceId={workspaceId}
            />
          ))}
          {canManage ? (
            <button
              className="group flex min-h-[184px] animate-dash-rise cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[22px] border border-dashed border-landing-border-strong p-[22px] text-center text-landing-text-2 [animation-fill-mode:backwards] motion-reduce:animate-none"
              onClick={onNewProject}
              style={riseStyle(projects.length + FIRST_CARD_RISE)}
              type="button"
            >
              <span className="grid size-12 place-items-center rounded-full border border-dashed border-landing-muted transition-[transform,border-color,color] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-90 group-hover:border-landing-accent group-hover:text-landing-accent motion-reduce:transition-none motion-reduce:group-hover:rotate-0">
                <PlusIcon size={20} />
              </span>
              <strong className="font-display text-[18px] font-bold text-landing-text">
                New project
              </strong>
              <span className="text-[14px] text-landing-muted">Group related monitors.</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
