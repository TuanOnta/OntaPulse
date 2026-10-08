import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { riseStyle } from "@/shared/lib/rise";
import { formatDay } from "@/shared/lib/format";
import { trackPointer } from "@/shared/lib/pointer-spotlight";
import type { Monitor } from "@/shared/types/domain";
import { cn } from "cn";

import { humanInterval, splitUrl } from "../model/monitor-format";

const GlobeIcon = () => (
  <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 22 22" width="22">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3 11 H19 M11 3 C8 6 8 16 11 19 C14 16 14 6 11 3 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.4"
    />
  </svg>
);

const CELL_KEY =
  "font-mono text-[11px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase";
const CELL_VALUE = "mt-0.5 text-[15px] font-medium text-landing-text-2";
const CELL =
  "pointer-events-none relative z-[2] max-[1359px]:col-start-2 max-[1359px]:flex max-[1359px]:items-baseline max-[1359px]:gap-2.5";

/**
 * One monitor: host and path, interval, date added, then an action area (scan chip, run button, chevron)
 * that the page supplies. The whole row is a stretched link, with the action area raised above it.
 */
export function MonitorRow({
  monitor,
  workspaceId,
  projectId,
  index,
  busy,
  actions,
}: {
  monitor: Monitor;
  workspaceId: string;
  projectId: string;
  index: number;
  busy: boolean;
  actions: ReactNode;
}) {
  const { protocol, host, path } = splitUrl(monitor.targetUrl);
  return (
    <article
      className={cn(
        "group relative grid animate-dash-rise grid-cols-[44px_minmax(0,1fr)_120px_120px_410px] items-center gap-[18px] overflow-hidden rounded-[20px] border border-landing-border bg-landing-surface/[.78] px-5 py-[18px] transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] [animation-fill-mode:backwards] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(320px_circle_at_var(--mx,50%)_var(--my,50%),rgb(232_241_236/0.06),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 before:content-[''] hover:-translate-y-0.5 hover:border-landing-border-strong hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.85)] hover:before:opacity-100 max-[1359px]:grid-cols-[44px_minmax(0,1fr)] max-[1359px]:gap-y-3.5 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
      onPointerMove={trackPointer}
      style={riseStyle(index)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none relative z-[2] grid size-11 place-items-center rounded-[13px] border border-landing-border-strong bg-[linear-gradient(145deg,var(--color-landing-surface-2),var(--color-landing-bg-2))] text-landing-text-2"
      >
        <GlobeIcon />
      </div>
      <div className="pointer-events-none relative z-[2] min-w-0">
        <div className="flex items-center gap-2.5 font-display text-[18px] leading-[normal] font-bold tracking-[-.01em]">
          <span className="truncate">{host}</span>
          {protocol ? (
            <span
              className={cn(
                "flex-none rounded-md border border-landing-border-strong px-[7px] py-0.5 font-mono text-[11px] leading-[normal] font-medium tracking-[.06em]",
                protocol === "https" ? "text-landing-text-2" : "text-landing-muted",
              )}
            >
              {protocol.toUpperCase()}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate font-mono text-[14px] leading-[normal] text-landing-muted">
          {path || "/"}
        </div>
      </div>
      <div className={CELL}>
        <div className={CELL_KEY}>Interval</div>
        <div className={CELL_VALUE}>{humanInterval(monitor.intervalSeconds)}</div>
      </div>
      <div className={CELL}>
        <div className={CELL_KEY}>Added</div>
        <div className={CELL_VALUE}>{formatDay(monitor.createdAt)}</div>
      </div>
      <div className="pointer-events-auto relative z-[2] flex items-center justify-end gap-2.5 max-[1359px]:col-span-full max-[1359px]:justify-between">
        {actions}
        <span
          aria-hidden="true"
          className="text-[18px] text-landing-muted transition-[transform,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-[5px] group-hover:text-landing-text motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >
          →
        </span>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 overflow-hidden opacity-0 transition-opacity duration-300 after:absolute after:inset-0 after:w-[38%] after:animate-pj-slide after:bg-[linear-gradient(90deg,transparent,var(--color-landing-info),transparent)] after:content-[''] motion-reduce:after:animate-none",
          busy && "opacity-100",
        )}
      />
      <Link
        aria-label={`Open monitor ${monitor.targetUrl}`}
        className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-offset-[-3px]"
        to={`/workspaces/${workspaceId}/projects/${projectId}/monitors/${monitor.id}`}
      />
    </article>
  );
}
