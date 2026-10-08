import { Link } from "react-router-dom";

import { formatClock, formatDay } from "@/shared/lib/format";
import type { Scan } from "@/shared/types/domain";
import { cn } from "cn";

import {
  formatMs,
  httpTone,
  isBusyScan,
  isSlow,
  relativeTime,
  statusChip,
} from "../model/scan-history";
import { ScanChip } from "./scan-run-chip";

const HTTP_TONE = {
  ok: "border-landing-border-strong text-landing-text-2",
  "client-error": "border-landing-warn/50 bg-landing-warn/[.07] text-landing-warn",
  "server-error": "border-landing-danger/50 bg-landing-danger/[.07] text-landing-danger-text",
} as const;

/** Grid shared by the header row and the scan rows (two columns below 1,100 px). */
export const SCAN_ROW_GRID =
  "grid grid-cols-[190px_130px_110px_minmax(0,1fr)_24px] items-center gap-4 px-5 max-[1099px]:grid-cols-[minmax(0,1fr)_auto] max-[1099px]:gap-y-2";

/** One scan of the history: status, HTTP code, response time, when, and a link to the scan. */
export function ScanRow({
  scan,
  href,
  now,
  fresh,
}: {
  scan: Scan;
  href: string;
  now: number;
  /** Highlights a scan that was just started from this screen. */
  fresh: boolean;
}) {
  const busy = isBusyScan(scan);
  const chip = statusChip(scan.status);
  const when = `${formatDay(scan.createdAt)}, ${formatClock(scan.createdAt)}`;

  return (
    <div
      className={cn(
        SCAN_ROW_GRID,
        "group relative border-t border-landing-border py-3.5 transition-colors duration-[250ms] first:border-t-0 hover:bg-landing-text/[.03] motion-reduce:transition-none",
        fresh && "animate-ws-flash motion-reduce:animate-none",
      )}
      role="row"
    >
      <span
        className="pointer-events-none relative max-[1099px]:col-start-1 max-[1099px]:row-start-1"
        role="cell"
      >
        <ScanChip label={chip.label} live={false} tone={chip.tone} />
      </span>
      <span
        className="pointer-events-none relative max-[1099px]:col-start-2 max-[1099px]:row-start-1 max-[1099px]:justify-self-end"
        role="cell"
      >
        {scan.statusCode != null ? (
          <span
            className={cn(
              "inline-flex min-h-7 items-center rounded-lg border px-2.5 font-mono text-[14px] leading-[normal] font-medium whitespace-nowrap",
              HTTP_TONE[httpTone(scan.statusCode)],
            )}
          >
            {scan.statusCode}
          </span>
        ) : (
          <span className="inline-flex min-h-7 items-center rounded-lg border border-dashed border-landing-border-strong px-2.5 font-mono text-[14px] leading-[normal] font-medium whitespace-nowrap text-landing-muted">
            {busy ? "pending" : "no response"}
          </span>
        )}
      </span>
      <span
        className="pointer-events-none relative max-[1099px]:col-start-1 max-[1099px]:row-start-2"
        role="cell"
      >
        {scan.responseTimeMs != null ? (
          <span
            className={cn(
              "font-mono text-[15px] tabular-nums",
              isSlow(scan.responseTimeMs) ? "text-landing-warn" : "text-landing-text-2",
            )}
          >
            {formatMs(scan.responseTimeMs)}
          </span>
        ) : (
          <span className="font-mono text-[15px] text-landing-muted">—</span>
        )}
      </span>
      <span
        className="pointer-events-none relative flex flex-wrap items-baseline gap-x-3 gap-y-0.5 max-[1099px]:col-span-full max-[1099px]:row-start-3"
        role="cell"
      >
        <span className="text-[15px] text-landing-text-2">{relativeTime(scan.createdAt, now)}</span>
        <span className="font-mono text-[13px] leading-[normal] text-landing-muted">{when}</span>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none relative text-[18px] text-landing-muted transition-[transform,color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-1 group-hover:text-landing-text max-[1099px]:hidden motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      >
        →
      </span>
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 overflow-hidden opacity-0 after:absolute after:inset-0 after:w-[38%] after:animate-pj-slide after:bg-[linear-gradient(90deg,transparent,var(--color-landing-info),transparent)] after:content-[''] motion-reduce:after:animate-none",
          busy && "opacity-100",
        )}
      />
      <Link
        aria-label={`Open scan from ${when}, ${chip.label.toLowerCase()}`}
        className="absolute inset-0 z-[1] focus-visible:outline-offset-[-3px]"
        to={href}
      />
    </div>
  );
}
