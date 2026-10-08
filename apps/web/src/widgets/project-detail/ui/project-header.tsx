import { TONE_VAR, type WorkspaceTone } from "@/entities/workspace";
import { formatDay } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";
import { LockIcon } from "@/shared/ui/lock-icon";
import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";

const FolderIcon = () => (
  <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 22 22" width="28">
    <path
      d="M3 6.5 A2 2 0 0 1 5 4.5 H8.6 L10.6 6.8 H17 A2 2 0 0 1 19 8.8 V15.5 A2 2 0 0 1 17 17.5 H5 A2 2 0 0 1 3 15.5 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

/** Project name, description and meta in a tile tinted with the tone of its workspace card. */
export function ProjectHeader({
  name,
  description,
  createdAt,
  tone,
  monitorCount,
  canManage,
  onAddMonitor,
}: {
  name: string;
  description?: string | null;
  createdAt: string;
  /** Same tone as the workspace card on the dashboard. */
  tone: WorkspaceTone;
  monitorCount: number | null;
  canManage: boolean;
  onAddMonitor: () => void;
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
          <FolderIcon />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(26px,3.2vw,38px)] leading-[1.08] font-bold tracking-[-.02em] [overflow-wrap:anywhere]">
            {name}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-[62ch] text-[16px] text-landing-muted">{description}</p>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[14px] leading-[normal] text-landing-muted">
            <span>Created {formatDay(createdAt)}</span>
            {monitorCount !== null ? (
              <span className="before:mr-3.5 before:text-landing-border-strong before:content-['·'] max-[520px]:before:hidden">
                {monitorCount} monitor{monitorCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="relative flex flex-wrap gap-2.5 max-[520px]:w-full">
        {canManage ? (
          <ActionButton
            className="max-[520px]:flex-[1_1_140px] max-[520px]:px-4 max-[520px]:whitespace-nowrap"
            onClick={onAddMonitor}
          >
            <PlusIcon />
            Add monitor
          </ActionButton>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-landing-border bg-landing-bg/50 px-3.5 py-2.5 text-[15px] text-landing-muted">
            <LockIcon />
            View-only access. Owners and admins manage monitors and scans.
          </div>
        )}
      </div>
    </header>
  );
}
