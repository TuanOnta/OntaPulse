import { TONE_VAR, type WorkspaceTone } from "@/entities/workspace";
import { riseStyle } from "@/shared/lib/rise";
import { LockIcon } from "@/shared/ui/lock-icon";
import { ActionButton } from "@/shared/ui/pill-button";

const GlobeIcon = () => (
  <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 22 22" width="28">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3 11 H19 M11 3 C8 6 8 16 11 19 C14 16 14 6 11 3 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
  </svg>
);

const PlayIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path d="M4.5 3 L12.5 8 L4.5 13 Z" fill="currentColor" />
  </svg>
);

/** Host, protocol tag and path of the target, with "Run scan" (or the view-only note). */
export function MonitorHeader({
  protocol,
  host,
  path,
  tone,
  canRun,
  busy,
  onRun,
}: {
  protocol: string;
  host: string;
  path: string;
  /** Same tone as the workspace card on the dashboard. */
  tone: WorkspaceTone;
  canRun: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <header
      className={`relative flex animate-dash-rise flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[26px] border border-landing-border bg-landing-surface/[.78] px-7 py-[26px] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(70%_140%_at_0%_0%,color-mix(in_srgb,var(--t)_12%,transparent),transparent_60%)] before:content-[''] max-[959px]:p-5 motion-reduce:animate-none ${TONE_VAR[tone]}`}
      style={riseStyle(1)}
    >
      <div className="relative flex min-w-0 items-center gap-[18px] max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-3">
        <div
          aria-hidden="true"
          className="grid size-16 flex-none place-items-center rounded-[20px] border border-[color-mix(in_srgb,var(--t)_40%,transparent)] [background:linear-gradient(145deg,color-mix(in_srgb,var(--t)_20%,transparent),var(--color-landing-bg-2)),var(--color-landing-bg-2)] text-landing-text shadow-[0_14px_30px_-12px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.08)]"
        >
          <GlobeIcon />
        </div>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-[clamp(24px,3vw,34px)] leading-[1.15] font-bold tracking-[-.015em] [overflow-wrap:anywhere]">
            <span>{host}</span>
            {protocol ? (
              <span className="flex-none rounded-[7px] border border-landing-border-strong px-[9px] py-[3px] font-mono text-[12px] leading-[normal] font-medium tracking-[.06em] text-landing-text-2">
                {protocol.toUpperCase()}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 font-mono text-[16px] text-landing-muted [overflow-wrap:anywhere]">
            {path || "/"}
          </p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-2.5 max-[520px]:w-full">
        {canRun ? (
          <ActionButton
            className="max-[520px]:flex-[1_1_140px] max-[520px]:px-4 max-[520px]:whitespace-nowrap"
            disabled={busy}
            onClick={onRun}
          >
            <PlayIcon />
            {busy ? "Scanning…" : "Run scan"}
          </ActionButton>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-landing-border bg-landing-bg/50 px-3.5 py-2.5 text-[15px] text-landing-muted">
            <LockIcon />
            View-only access. Owners and admins run scans.
          </div>
        )}
      </div>
    </header>
  );
}
