import { ActionButton, ButtonLink } from "@/shared/ui/pill-button";
import { StateArt } from "@/shared/ui/state-art";

export const PANEL =
  "flex flex-col items-center gap-3 rounded-[26px] border border-dashed border-landing-border-strong bg-landing-surface/50 px-6 py-16 text-center";
export const PANEL_TITLE = "font-display text-[28px] font-bold tracking-[-.01em]";
export const PANEL_TEXT = "max-w-[46ch] text-landing-muted";

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

/** Request failed: API message, request id for support and a retry button. */
export function LoadErrorBanner({
  title,
  message,
  requestId,
  onRetry,
}: {
  title: string;
  message: string;
  requestId?: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex animate-dash-drop items-start gap-3.5 rounded-2xl border border-[rgb(255_122_107/0.45)] bg-landing-danger/[.07] px-[18px] py-4 text-landing-danger-text motion-reduce:animate-none max-[520px]:flex-wrap"
      role="alert"
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 flex-none"
        fill="none"
        height="22"
        viewBox="0 0 20 20"
        width="22"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 6 V11 M10 13.6 V14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
      <div>
        <strong className="block text-[17px] font-semibold">{title}</strong>
        <small className="mt-0.5 block font-mono text-[13px] leading-[normal] text-landing-muted">
          {message}
        </small>
        {requestId ? (
          <small className="block font-mono text-[13px] leading-[normal] text-landing-muted">
            Request ID: {requestId}
          </small>
        ) : null}
      </div>
      <ActionButton
        className="ml-auto min-h-10 px-[18px] text-[15px] max-[520px]:mx-0 max-[520px]:w-full"
        onClick={onRetry}
        variant="ghost"
      >
        Try again
      </ActionButton>
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
