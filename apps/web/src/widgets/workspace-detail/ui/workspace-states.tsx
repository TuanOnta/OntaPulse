import { ButtonLink } from "@/shared/ui/pill-button";
import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";
import { StateArt } from "@/shared/ui/state-art";

/** The workspace does not exist or the user is not a member (the API answers 404 for both). */
export function WorkspaceNotFound() {
  return (
    <div className={PANEL}>
      <StateArt />
      <h2 className={PANEL_TITLE}>Workspace not found</h2>
      <p className={PANEL_TEXT}>
        It may not exist, or you may not be a member. Head back to your dashboard.
      </p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/dashboard">Back to dashboard</ButtonLink>
      </div>
    </div>
  );
}

const BAR = "block rounded-lg bg-landing-surface-2";
const SHEEN =
  "relative overflow-hidden after:absolute after:inset-0 after:animate-dash-sheen after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_30%,rgb(232_241_236/0.05)_50%,transparent_70%)] after:content-[''] motion-reduce:after:animate-none";

/** Placeholder for the hero and three project cards while the workspace loads. */
export function WorkspaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" role="status">
      <div className="rounded-[26px] border border-landing-border bg-landing-surface/[.78]">
        <div className="h-[132px] border-b border-landing-border" />
        <div className={`${SHEEN} flex flex-col gap-3.5 px-7 pb-[26px]`}>
          <i className={`${BAR} -mt-9 size-[72px] rounded-[22px]`} />
          <i className={`${BAR} h-5 w-[min(420px,62%)]`} />
          <i className={`${BAR} h-3.5 w-[38%]`} />
        </div>
      </div>
      <ProjectsSkeleton className="mt-7" />
    </div>
  );
}

export function ProjectsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 max-[520px]:grid-cols-[minmax(0,1fr)] ${className}`}
    >
      {[0, 1, 2].map((key) => (
        <div
          className={`${SHEEN} flex min-h-[176px] flex-col gap-3.5 rounded-[22px] border border-landing-border bg-landing-surface/60 p-[22px]`}
          key={key}
        >
          <i className={`${BAR} size-[46px] rounded-[14px]`} />
          <i className={`${BAR} mt-2 h-5 w-[62%]`} />
          <i className={`${BAR} h-3.5 w-[38%]`} />
        </div>
      ))}
    </div>
  );
}

export { LoadErrorBanner } from "@/shared/ui/state-panel";
