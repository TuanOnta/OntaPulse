import { ScanChip, ScanOrb, scanOutcome, statusChip } from "@/entities/scan";
import { relativeTime } from "@/entities/scan";
import { formatFull } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";
import type { ScanDetail } from "@/shared/types/domain";
import { LockIcon } from "@/shared/ui/lock-icon";
import { ActionButton } from "@/shared/ui/pill-button";

/** Tone colour (`--c`, an r,g,b triplet) per outcome; the whole scan screen reads it. */
export const TONE = {
  queued: "[--c:147,165,156]",
  running: "[--c:124,196,255]",
  ok: "[--c:94,242,160]",
  warn: "[--c:255,180,84]",
  bad: "[--c:255,122,107]",
} as const;

const PlayIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path d="M4.5 3 L12.5 8 L4.5 13 Z" fill="currentColor" />
  </svg>
);

/** What the hero offers: run again, a view-only note, or nothing when the role is unknown. */
export type HeroAction = "run" | "view-only" | "none";

export function ScanHero({
  scan,
  host,
  now,
  action,
  busy,
  onRunAgain,
}: {
  scan: ScanDetail;
  host?: string;
  now: number;
  action: HeroAction;
  busy: boolean;
  onRunAgain: () => void;
}) {
  const outcome = scanOutcome(scan, host);
  const chipTone =
    scan.status === "SUCCEEDED" && scan.findings.length > 0 ? "warn" : statusChip(scan.status).tone;

  return (
    <header
      className={`relative flex animate-dash-rise flex-wrap items-center justify-between gap-[22px] overflow-hidden rounded-[28px] border border-landing-border bg-landing-surface/[.78] p-7 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(70%_160%_at_0%_0%,rgba(var(--c),0.16),transparent_60%)] before:transition-[background] before:duration-[600ms] before:content-[''] max-[640px]:px-[18px] max-[640px]:py-[22px] motion-reduce:animate-none`}
      style={riseStyle(1)}
    >
      <div className="relative flex min-w-0 items-center gap-6 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-4">
        <ScanOrb kind={outcome.orb} />
        <div className="min-w-0">
          <div className="mb-3">
            <ScanChip label={statusChip(scan.status).label} tone={chipTone} />
          </div>
          <h1 className="font-display text-[clamp(26px,3.2vw,38px)] leading-[1.08] font-bold tracking-[-.02em]">
            {outcome.title}
          </h1>
          <p className="mt-1.5 text-[17px] text-landing-text-2">{outcome.sub}</p>
          <p className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[14px] leading-[normal] text-landing-muted">
            {host ? <span>{host}</span> : null}
            <span
              className={
                host ? "before:mr-3.5 before:text-landing-border-strong before:content-['·']" : ""
              }
              title={formatFull(scan.createdAt)}
            >
              Started {relativeTime(scan.createdAt, now)}
            </span>
          </p>
        </div>
      </div>
      {action === "none" ? null : (
        <div className="relative flex flex-wrap gap-2.5 max-[640px]:w-full">
          {action === "run" ? (
            <ActionButton
              className="max-[640px]:flex-[1_1_140px] max-[640px]:px-4 max-[640px]:whitespace-nowrap"
              disabled={busy}
              onClick={onRunAgain}
            >
              <PlayIcon />
              Run scan again
            </ActionButton>
          ) : (
            <div className="flex items-center gap-2.5 rounded-[14px] border border-landing-border bg-landing-bg/50 px-3.5 py-2.5 text-[15px] text-landing-muted">
              <LockIcon />
              View-only access.
            </div>
          )}
        </div>
      )}
    </header>
  );
}
