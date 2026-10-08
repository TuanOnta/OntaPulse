import { ActionButton } from "@/shared/ui/pill-button";

/** Dashed panel for empty, not-found and no-result states. */
export const PANEL =
  "flex flex-col items-center gap-3 rounded-[26px] border border-dashed border-landing-border-strong bg-landing-surface/50 px-6 py-16 text-center";
export const PANEL_TITLE = "font-display text-[28px] font-bold tracking-[-.01em]";
export const PANEL_TEXT = "max-w-[46ch] text-landing-muted";

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
