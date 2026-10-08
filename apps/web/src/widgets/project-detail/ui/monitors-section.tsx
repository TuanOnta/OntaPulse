import { useState } from "react";

import { MonitorRow, filterMonitors, splitUrl, type MonitorsError } from "@/entities/monitor";
import { ScanRunChip, isRunBusy, type ScanRun } from "@/entities/scan";
import { RunScanButton } from "@/features/monitors/run-scan-button";
import { riseStyle } from "@/shared/lib/rise";
import type { Monitor } from "@/shared/types/domain";
import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";
import { StateArt } from "@/shared/ui/state-art";
import { LoadErrorBanner, PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";

import { MonitorsSkeleton } from "./project-states";

/** Index of the first monitor row in the entrance sequence (header is 1, section head is 2). */
const FIRST_ROW_RISE = 3;

export type MonitorsSectionProps = {
  workspaceId: string;
  projectId: string;
  status: "loading" | "ready" | "error";
  monitors: Monitor[];
  error: MonitorsError | null;
  canManage: boolean;
  runs: Record<string, ScanRun>;
  onRunScan: (monitor: Monitor) => void;
  onAddMonitor: () => void;
  onReload: () => void;
};

/** "Monitors" head with search, then the list or its loading, empty, no-results and error states. */
export function MonitorsSection({
  workspaceId,
  projectId,
  status,
  monitors,
  error,
  canManage,
  runs,
  onRunScan,
  onAddMonitor,
  onReload,
}: MonitorsSectionProps) {
  const [query, setQuery] = useState("");
  const visible = filterMonitors(monitors, query);

  return (
    <section aria-labelledby="monitors-title">
      <div
        className="mt-[30px] mb-4 flex animate-dash-rise flex-wrap items-center justify-between gap-3.5 motion-reduce:animate-none"
        style={riseStyle(2)}
      >
        <div>
          <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="monitors-title">
            Monitors
          </h2>
          <p className="mt-0.5 text-[15px] text-landing-muted">
            Open a monitor to see its scan history and findings.
          </p>
        </div>
        <label className="relative max-w-[340px] flex-[1_1_260px] max-[520px]:max-w-none max-[520px]:basis-full">
          <span className="sr-only">Search monitors</span>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-landing-muted"
            fill="none"
            height="18"
            viewBox="0 0 20 20"
            width="18"
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M13.5 13.5 L17 17"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </svg>
          <input
            autoComplete="off"
            className="min-h-11 w-full rounded-[14px] border border-landing-border bg-landing-bg/70 pr-3.5 pl-[42px] text-[16px] text-landing-text transition-[border-color,box-shadow] duration-200 placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none motion-reduce:transition-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search monitors"
            spellCheck={false}
            type="search"
            value={query}
          />
        </label>
      </div>

      {status === "loading" ? (
        <MonitorsSkeleton />
      ) : status === "error" ? (
        <LoadErrorBanner
          message={error?.message ?? ""}
          onRetry={onReload}
          requestId={error?.requestId}
          title="Couldn’t load monitors."
        />
      ) : monitors.length === 0 ? (
        <div className={PANEL}>
          <StateArt />
          <h2 className={PANEL_TITLE}>No monitors yet</h2>
          <p className={PANEL_TEXT}>
            {canManage
              ? "Add a URL and OntaPulse will check it on your interval. You can also run a scan any time."
              : "An owner or admin needs to add the first monitor."}
          </p>
          {canManage ? (
            <div className="mt-2.5 flex flex-wrap justify-center gap-3">
              <ActionButton onClick={onAddMonitor}>
                <PlusIcon />
                Add monitor
              </ActionButton>
            </div>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <div className={PANEL}>
          <StateArt />
          <h2 className={PANEL_TITLE}>No matching monitors</h2>
          <p className={PANEL_TEXT}>Nothing matches “{query.trim()}”.</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-3">
            <ActionButton onClick={() => setQuery("")} variant="ghost">
              Clear search
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((monitor, index) => {
            const run = runs[monitor.id];
            const busy = isRunBusy(run);
            return (
              <MonitorRow
                actions={
                  <>
                    {run ? <ScanRunChip run={run} /> : null}
                    {canManage ? (
                      <RunScanButton
                        busy={busy}
                        host={splitUrl(monitor.targetUrl).host}
                        onRun={() => onRunScan(monitor)}
                      />
                    ) : null}
                  </>
                }
                busy={busy}
                index={index + FIRST_ROW_RISE}
                key={monitor.id}
                monitor={monitor}
                projectId={projectId}
                workspaceId={workspaceId}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
