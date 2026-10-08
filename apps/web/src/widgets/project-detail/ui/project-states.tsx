import { ButtonLink } from "@/shared/ui/pill-button";
import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";
import { StateArt } from "@/shared/ui/state-art";

const BAR = "block rounded-lg bg-landing-surface-2";
const SHEEN =
  "relative overflow-hidden after:absolute after:inset-0 after:animate-dash-sheen after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_30%,rgb(232_241_236/0.05)_50%,transparent_70%)] after:content-[''] motion-reduce:after:animate-none";

/** The project does not exist or the user is not in its workspace (the API answers 404 for both). */
export function ProjectNotFound({ workspaceId }: { workspaceId?: string }) {
  return (
    <div className={PANEL}>
      <StateArt />
      <h2 className={PANEL_TITLE}>Project not found</h2>
      <p className={PANEL_TEXT}>It may not exist, or you may not be a member of this workspace.</p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-3">
        <ButtonLink to={workspaceId ? `/workspaces/${workspaceId}` : "/dashboard"}>
          {workspaceId ? "Back to workspace" : "Back to dashboard"}
        </ButtonLink>
      </div>
    </div>
  );
}

export function MonitorsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading monitors"
      className={`flex flex-col gap-3 ${className}`}
      role="status"
    >
      {[0, 1, 2].map((key) => (
        <div
          className={`${SHEEN} flex min-h-[92px] flex-col justify-center gap-3.5 rounded-[22px] border border-landing-border bg-landing-surface/60 p-[22px]`}
          key={key}
        >
          <i className={`${BAR} h-5 w-[62%]`} />
          <i className={`${BAR} h-3.5 w-[38%]`} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for the header and three monitor rows while the project loads. */
export function ProjectDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading project" role="status">
      <div
        className={`${SHEEN} flex flex-col gap-3.5 rounded-[26px] border border-landing-border bg-landing-surface/[.78] px-7 py-[26px]`}
      >
        <i className={`${BAR} size-16 rounded-[20px]`} />
        <i className={`${BAR} h-5 w-[min(420px,62%)]`} />
        <i className={`${BAR} h-3.5 w-[38%]`} />
      </div>
      <MonitorsSkeleton className="mt-[30px]" />
    </div>
  );
}
