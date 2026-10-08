import { scanTimeline, type TimelineState } from "@/entities/scan";
import { copyToClipboard } from "@/shared/lib/copy-to-clipboard";
import { formatClockSeconds, formatFull } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";
import type { ScanDetail } from "@/shared/types/domain";
import { cn } from "cn";

const BOX = "min-w-0 rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]";
const BOX_TITLE = "mb-4 font-display text-[19px] font-bold tracking-[-.01em]";

const DOT: Record<TimelineState, string> = {
  done: "border-[rgb(var(--c))] bg-[rgba(var(--c),0.12)] text-[rgb(var(--c))]",
  active:
    "border-landing-info text-landing-info after:absolute after:-inset-1.5 after:animate-sc-ring after:rounded-full after:border-2 after:border-landing-info after:opacity-0 after:content-[''] motion-reduce:after:animate-none",
  pending: "border-landing-border-strong text-landing-muted",
  bad: "border-landing-danger bg-landing-danger/10 text-landing-danger-text",
};
const MARK: Record<TimelineState, string> = { done: "✓", active: "", pending: "", bad: "×" };

const CopyIcon = () => (
  <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 20 20" width="15">
    <rect height="9.5" rx="2" stroke="currentColor" strokeWidth="1.5" width="9.5" x="7" y="7" />
    <path
      d="M13 7 V5.5 A2 2 0 0 0 11 3.5 H5.5 A2 2 0 0 0 3.5 5.5 V11 A2 2 0 0 0 5.5 13 H7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

function CopyButton({ label, text, message }: { label: string; text: string; message: string }) {
  return (
    <button
      aria-label={label}
      className="ml-1.5 inline-grid size-[30px] cursor-pointer place-items-center rounded-lg border border-transparent align-middle text-landing-muted transition-[background-color,color,border-color] duration-200 hover:border-landing-border hover:bg-landing-surface-2 hover:text-landing-text motion-reduce:transition-none"
      onClick={() => void copyToClipboard(text, message)}
      type="button"
    >
      <CopyIcon />
    </button>
  );
}

const DT =
  "pt-[3px] font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase";
const DD = "m-0 text-[16px] text-landing-text-2 [overflow-wrap:anywhere] max-[640px]:mb-2.5";

/** Lifecycle timeline and request details side by side (stacked below 1,100 px). */
export function LifecycleAndRequest({
  scan,
  targetUrl,
}: {
  scan: ScanDetail;
  /** Known only on the nested route, where the monitor is loaded. */
  targetUrl?: string;
}) {
  const steps = scanTimeline(scan);

  return (
    <div
      className="mt-3.5 grid animate-dash-rise grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-3.5 max-[1099px]:grid-cols-1 motion-reduce:animate-none"
      style={riseStyle(3)}
    >
      <section aria-labelledby="lifecycle-title" className={BOX}>
        <h2 className={BOX_TITLE} id="lifecycle-title">
          Lifecycle
        </h2>
        <ol className="m-0 list-none p-0">
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li
                className={cn(
                  "relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3.5 max-[640px]:grid-cols-[28px_minmax(0,1fr)]",
                  !last &&
                    "pb-[22px] before:absolute before:top-7 before:bottom-0 before:left-[13px] before:w-0.5 before:content-['']",
                  !last &&
                    (step.state === "done"
                      ? "before:bg-[rgba(var(--c),0.6)]"
                      : "before:bg-landing-border"),
                )}
                key={step.title}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] grid size-7 place-items-center rounded-full border-2 bg-landing-bg text-[12px]",
                    DOT[step.state],
                  )}
                >
                  {MARK[step.state]}
                </span>
                <div>
                  <div
                    className={cn(
                      "text-[16px]",
                      step.state === "pending" ? "font-medium text-landing-muted" : "font-semibold",
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="mt-0.5 text-[14px] text-landing-muted">{step.sub}</div>
                </div>
                <span className="text-right font-mono text-[13px] leading-[normal] whitespace-nowrap text-landing-muted max-[640px]:col-start-2 max-[640px]:text-left">
                  {step.at ? formatClockSeconds(step.at) : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="request-title" className={BOX}>
        <h2 className={BOX_TITLE} id="request-title">
          Request
        </h2>
        <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3.5 max-[640px]:grid-cols-1 max-[640px]:gap-y-1">
          <dt className={DT}>Target</dt>
          <dd className={cn(DD, "font-mono text-[14px]")}>
            {targetUrl ? (
              <>
                {targetUrl}
                <CopyButton label="Copy target URL" message="Target URL copied." text={targetUrl} />
              </>
            ) : (
              <span className="font-body text-[16px] text-landing-muted">Not available</span>
            )}
          </dd>
          <dt className={DT}>Method</dt>
          <dd className={DD}>GET, redirects are not followed</dd>
          <dt className={DT}>Scan ID</dt>
          <dd className={cn(DD, "font-mono text-[14px]")}>
            {scan.id}
            <CopyButton label="Copy scan ID" message="Scan ID copied." text={scan.id} />
          </dd>
          <dt className={DT}>Created</dt>
          <dd className={DD}>{formatFull(scan.createdAt)}</dd>
          <dt className={DT}>Finished</dt>
          <dd className={DD}>
            {scan.finishedAt ? (
              formatFull(scan.finishedAt)
            ) : (
              <span className="text-landing-muted">Not finished yet</span>
            )}
          </dd>
        </dl>
      </section>
    </div>
  );
}
