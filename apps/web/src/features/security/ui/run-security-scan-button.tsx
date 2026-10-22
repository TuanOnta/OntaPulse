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

const GlobeIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M1.8 8 H14.2 M8 1.8 C5.6 4.2 5.6 11.8 8 14.2 M8 1.8 C10.4 4.2 10.4 11.8 8 14.2"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.2"
    />
  </svg>
);

const COPY = {
  security: {
    label: "Run security scan",
    noun: "security",
    off: "Turn on security checks first.",
    Icon: ShieldIcon,
  },
  dns: { label: "Run DNS scan", noun: "DNS", off: "Turn on DNS watch first.", Icon: GlobeIcon },
} as const;

/**
 * "Run security scan" (or "Run DNS scan") for one monitor. Off while the checks are off, while a scan is
 * being queued, and until a rate limit lifts; the reason is written next to the button, not only in a tooltip.
 */
export function RunSecurityScanButton({
  host,
  enabled,
  busy,
  waitSeconds,
  onRun,
  kind = "security",
}: {
  host: string;
  enabled: boolean;
  busy: boolean;
  /** Seconds until another run is allowed; 0 or less when allowed. */
  waitSeconds: number;
  onRun: () => void;
  kind?: keyof typeof COPY;
}) {
  const copy = COPY[kind];
  const waiting = waitSeconds > 0;
  const hint = !enabled
    ? copy.off
    : waiting
      ? `You can run another ${copy.noun} scan in ${formatWait(waitSeconds)}.`
      : null;

  return (
    <div className="flex flex-col items-start gap-1.5 max-[520px]:w-full">
      <ActionButton
        aria-label={`${copy.label} for ${host}`}
        className={`${SMALL_PILL} max-[520px]:w-full`}
        disabled={!enabled || busy || waiting}
        onClick={onRun}
        variant="ghost"
      >
        <copy.Icon />
        {busy ? "Scanning…" : copy.label}
      </ActionButton>
      {hint ? <p className="text-[14px] text-landing-muted">{hint}</p> : null}
    </div>
  );
}
