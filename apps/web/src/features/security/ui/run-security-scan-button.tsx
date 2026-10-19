import { formatWait } from "@/entities/scan";
import { ActionButton, SMALL_PILL } from "@/shared/ui/pill-button";

const ShieldIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path
      d="M8 1.8 L13 3.6 V7.6 C13 10.6 10.9 12.7 8 14.2 C5.1 12.7 3 10.6 3 7.6 V3.6 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
  </svg>
);

/**
 * "Run security scan" for one monitor. Off while the checks are off, while a scan is being queued, and
 * until a rate limit lifts; the reason is written next to the button, not only in a tooltip.
 */
export function RunSecurityScanButton({
  host,
  enabled,
  busy,
  waitSeconds,
  onRun,
}: {
  host: string;
  enabled: boolean;
  busy: boolean;
  /** Seconds until another run is allowed; 0 or less when allowed. */
  waitSeconds: number;
  onRun: () => void;
}) {
  const waiting = waitSeconds > 0;
  const hint = !enabled
    ? "Turn on security checks first."
    : waiting
      ? `You can run another security scan in ${formatWait(waitSeconds)}.`
      : null;

  return (
    <div className="flex flex-col items-start gap-1.5 max-[520px]:w-full">
      <ActionButton
        aria-label={`Run security scan for ${host}`}
        className={`${SMALL_PILL} max-[520px]:w-full`}
        disabled={!enabled || busy || waiting}
        onClick={onRun}
        variant="ghost"
      >
        <ShieldIcon />
        {busy ? "Scanning…" : "Run security scan"}
      </ActionButton>
      {hint ? <p className="text-[14px] text-landing-muted">{hint}</p> : null}
    </div>
  );
}
