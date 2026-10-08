import { useState } from "react";

import {
  HISTORY_FILTERS,
  HISTORY_LIMIT,
  SCAN_ROW_GRID,
  ScanRow,
  countByFilter,
  filterScans,
  type HistoryFilter,
} from "@/entities/scan";
import { riseStyle } from "@/shared/lib/rise";
import type { Scan } from "@/shared/types/domain";
import { ActionButton } from "@/shared/ui/pill-button";
import { StateArt } from "@/shared/ui/state-art";
import { LoadErrorBanner, PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";
import { cn } from "cn";

const InfoIcon = () => (
  <svg
    aria-hidden="true"
    className="mt-[3px] flex-none"
    fill="none"
    height="16"
    viewBox="0 0 20 20"
    width="16"
  >
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M10 9 V14 M10 6.2 V6.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
);

const PlayIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path d="M4.5 3 L12.5 8 L4.5 13 Z" fill="currentColor" />
  </svg>
);

export type ScanHistoryProps = {
  workspaceId: string;
  projectId: string;
  monitorId: string;
  status: "loading" | "ready" | "error";
  scans: Scan[];
  error: { message: string; requestId?: string } | null;
  canRun: boolean;
  busy: boolean;
  freshId: string | null;
  now: number;
  onRun: () => void;
  onReload: () => void;
};

/** "Scan history": status filter with counts, the newest scans, and the empty / error states. */
export function ScanHistory({
  workspaceId,
  projectId,
  monitorId,
  status,
  scans,
  error,
  canRun,
  busy,
  freshId,
  now,
  onRun,
  onReload,
}: ScanHistoryProps) {
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const counts = countByFilter(scans);
  const matching = filterScans(scans, filter);
  const visible = matching.slice(0, HISTORY_LIMIT);

  return (
    <section aria-labelledby="scan-history-title">
      <div
        className="mt-[30px] mb-4 flex animate-dash-rise flex-wrap items-center justify-between gap-3.5 motion-reduce:animate-none"
        style={riseStyle(4)}
      >
        <div>
          <h2
            className="font-display text-[22px] font-bold tracking-[-.01em]"
            id="scan-history-title"
          >
            Scan history
          </h2>
          <p className="mt-0.5 text-[15px] text-landing-muted">Open a scan to see its findings.</p>
        </div>
        {status === "ready" && scans.length > 0 ? (
          <div aria-label="Filter scans" className="flex flex-wrap gap-2" role="group">
            {HISTORY_FILTERS.map(({ id, label }) => (
              <button
                aria-pressed={filter === id}
                className={cn(
                  "min-h-10 cursor-pointer rounded-full border px-4 text-[15px] font-medium transition-colors duration-200 motion-reduce:transition-none",
                  filter === id
                    ? "border-landing-muted bg-landing-surface-2 text-landing-text"
                    : "border-landing-border text-landing-text-2 hover:border-landing-border-strong hover:text-landing-text",
                )}
                key={id}
                onClick={() => setFilter(id)}
                type="button"
              >
                {label}
                <span className="ml-1.5 font-mono text-[13px] text-landing-muted">
                  {counts[id]}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="animate-dash-rise motion-reduce:animate-none" style={riseStyle(5)}>
        {status === "loading" ? (
          <div
            aria-busy="true"
            aria-label="Loading scans"
            className="h-40 animate-pulse rounded-[22px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
            role="status"
          />
        ) : status === "error" ? (
          <LoadErrorBanner
            message={error?.message ?? ""}
            onRetry={onReload}
            requestId={error?.requestId}
            title="Couldn’t load the scan history."
          />
        ) : scans.length === 0 ? (
          <div className={PANEL}>
            <StateArt />
            <h2 className={PANEL_TITLE}>No scans yet</h2>
            <p className={PANEL_TEXT}>
              {canRun
                ? "Run the first scan to see its status, HTTP code and response time here."
                : "An owner or admin needs to run the first scan."}
            </p>
            {canRun ? (
              <div className="mt-2.5 flex flex-wrap justify-center gap-3">
                <ActionButton disabled={busy} onClick={onRun}>
                  <PlayIcon />
                  Run scan
                </ActionButton>
              </div>
            ) : null}
          </div>
        ) : matching.length === 0 ? (
          <div className={PANEL}>
            <h2 className={PANEL_TITLE}>No {filter.toLowerCase()} scans</h2>
            <p className={PANEL_TEXT}>Nothing in the scan history matches this filter.</p>
          </div>
        ) : (
          <>
            <div
              aria-label="Scan history"
              className="flex flex-col overflow-hidden rounded-[22px] border border-landing-border bg-landing-surface/[.72]"
              role="table"
            >
              <div
                className={cn(
                  SCAN_ROW_GRID,
                  "bg-landing-bg/50 py-3 font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase max-[1099px]:hidden",
                )}
                role="row"
              >
                <span role="columnheader">Status</span>
                <span role="columnheader">HTTP</span>
                <span role="columnheader">Response</span>
                <span role="columnheader">When</span>
                <span role="columnheader" />
              </div>
              <div role="rowgroup">
                {visible.map((scan) => (
                  <ScanRow
                    fresh={scan.id === freshId}
                    href={`/workspaces/${workspaceId}/projects/${projectId}/monitors/${monitorId}/scans/${scan.id}`}
                    key={scan.id}
                    now={now}
                    scan={scan}
                  />
                ))}
              </div>
            </div>
            <p className="mt-3.5 flex items-start gap-2 text-[14px] text-landing-muted">
              <InfoIcon />
              <span>
                Succeeded means the target answered. A 4xx or 5xx response is still Succeeded and
                creates findings; Failed means a timeout, DNS or connection error.
                {matching.length > HISTORY_LIMIT
                  ? ` Showing the latest ${HISTORY_LIMIT} of ${matching.length} scans.`
                  : ""}
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
