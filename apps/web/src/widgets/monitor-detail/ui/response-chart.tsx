import {
  SLOW_MS,
  barHeightPercent,
  chartGrid,
  chartMax,
  chartScans,
  formatMs,
  isSlow,
} from "@/entities/scan";
import { formatClock } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";
import type { Scan } from "@/shared/types/domain";
import { cn } from "cn";

const GAP = "gap-[clamp(4px,1.2vw,12px)]";

/** Keeps the tooltip of the first and last bars inside the card instead of widening the page. */
function tooltipAlign(index: number, count: number): string {
  if (index < count / 3) return "left-0";
  if (index >= (count * 2) / 3) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

/**
 * Bar chart of the latest finished scans, derived from the history list (not an aggregate endpoint). The
 * amber line is the 2,000 ms SLOW_RESPONSE threshold; failed scans show a "×" instead of a bar.
 */
export function ResponseChart({ scans, freshId }: { scans: Scan[]; freshId: string | null }) {
  const done = chartScans(scans);
  if (done.length === 0) return null;
  const max = chartMax(done.map((scan) => scan.responseTimeMs ?? 0));

  return (
    <section
      aria-labelledby="response-chart-title"
      className="mt-[26px] animate-dash-rise rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px] max-[520px]:p-4 motion-reduce:animate-none"
      style={riseStyle(3)}
    >
      <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h2
            className="font-display text-[20px] font-bold tracking-[-.01em]"
            id="response-chart-title"
          >
            Response time
          </h2>
          <p className="text-[14px] text-landing-muted">
            Last {done.length} finished scan{done.length === 1 ? "" : "s"}, oldest to newest
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-landing-muted">
          <span className="inline-flex items-center gap-[7px]">
            <i className="size-2.5 rounded-[3px] bg-landing-info" />
            Normal
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <i className="size-2.5 rounded-[3px] bg-landing-warn" />
            Slow ({SLOW_MS.toLocaleString("en-US")} ms or more)
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <i className="size-2.5 rounded-full border-[1.5px] border-landing-danger" />
            Failed
          </span>
        </div>
      </div>
      <div className="[--yl:52px] max-[520px]:[--yl:44px]">
        <div className="relative h-44 pl-[var(--yl)]">
          {chartGrid(max).map((line) => (
            <div
              className={cn(
                "absolute right-0 left-[var(--yl)] border-t border-dashed",
                line.slow ? "border-landing-warn/55" : "border-landing-border",
              )}
              key={line.ms}
              style={{ top: `${line.top}%` }}
            >
              <span
                className={cn(
                  "absolute -top-[9px] left-[calc(var(--yl)*-1)] w-[calc(var(--yl)-8px)] text-right font-mono text-[12px] leading-[normal]",
                  line.slow ? "text-landing-warn" : "text-landing-muted",
                )}
              >
                {line.label}
              </span>
            </div>
          ))}
          <div className={cn("absolute inset-y-0 right-0 left-[var(--yl)] flex items-end", GAP)}>
            {done.map((scan, index) => {
              const when = formatClock(scan.createdAt);
              const failed = scan.status === "FAILED";
              const slow = isSlow(scan.responseTimeMs);
              const fresh = scan.id === freshId;
              const label = failed
                ? `Failed scan at ${when}`
                : `${scan.responseTimeMs ?? 0} milliseconds at ${when}${slow ? ", slow" : ""}`;
              return (
                <div
                  aria-label={label}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-offset-2"
                  key={scan.id}
                  role="img"
                  tabIndex={0}
                >
                  {failed ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 grid size-[22px] place-items-center rounded-full border-[1.5px] border-landing-danger bg-landing-danger/10 text-[12px] text-landing-danger-text"
                    >
                      ×
                    </span>
                  ) : (
                    <div
                      className={cn(
                        "w-full max-w-10 origin-bottom rounded-[7px_7px_3px_3px] transition-[filter] duration-200 group-hover:brightness-125 group-focus-visible:brightness-125 motion-reduce:animate-none motion-reduce:transition-none",
                        fresh ? "animate-pj-grow-glow" : "animate-pj-grow",
                        slow
                          ? "bg-[linear-gradient(180deg,var(--color-landing-warn),rgb(255_180_84/0.45))]"
                          : "bg-[linear-gradient(180deg,var(--color-landing-info),rgb(124_196_255/0.45))]",
                      )}
                      style={{
                        height: `${barHeightPercent(scan.responseTimeMs ?? 0, max)}%`,
                        animationDelay: `${index * 40}ms`,
                      }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute bottom-[calc(100%+6px)] z-[3] translate-y-1 rounded-[10px] border border-landing-border-strong bg-landing-surface-2 px-2.5 py-1.5 font-mono text-[12px] leading-[normal] font-medium whitespace-nowrap opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none",
                      tooltipAlign(index, done.length),
                    )}
                  >
                    {when} ·{" "}
                    {failed
                      ? "failed"
                      : `${formatMs(scan.responseTimeMs ?? 0)}${scan.statusCode ? ` · ${scan.statusCode}` : ""}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "mt-2 flex pl-[var(--yl)] font-mono text-[11px] leading-[normal] text-landing-muted max-[640px]:hidden",
            GAP,
          )}
        >
          {done.map((scan) => (
            <span className="min-w-0 flex-1 overflow-hidden text-center" key={scan.id}>
              {formatClock(scan.createdAt)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
