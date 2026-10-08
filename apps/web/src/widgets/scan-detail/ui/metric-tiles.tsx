import {
  METER_TICK_PERCENT,
  SLOW_MS,
  codeClass,
  httpStatusText,
  isSlow,
  meterPercent,
  severityCounts,
  type CodeClass,
} from "@/entities/scan";
import { riseStyle } from "@/shared/lib/rise";
import type { ScanDetail } from "@/shared/types/domain";
import { cn } from "cn";

const TILE =
  "relative min-w-0 rounded-[20px] border border-landing-border bg-landing-surface/[.72] px-[22px] py-5";
const KEY =
  "font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase";
const VALUE =
  "mt-2 flex items-baseline gap-2 font-display text-[clamp(34px,4vw,46px)] leading-none font-bold tracking-[-.02em] tabular-nums";
const SUB = "mt-2 text-[14px] text-landing-muted";

const CODE_COLOR: Record<CodeClass, string> = {
  c2: "text-landing-text",
  c4: "text-landing-warn",
  c5: "text-landing-danger-text",
  cnone: "text-landing-muted",
};

const SEVERITY_TONE = {
  LOW: "[--s:147,165,156]",
  MEDIUM: "[--s:255,180,84]",
  HIGH: "[--s:255,122,107]",
  CRITICAL: "[--s:255,92,120]",
} as const;

export function SeverityPill({
  severity,
  children,
}: {
  severity: keyof typeof SEVERITY_TONE;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center self-start rounded-full border border-[rgba(var(--s),0.6)] bg-[rgba(var(--s),0.1)] px-3 font-mono text-[12px] leading-[normal] font-semibold tracking-[.08em] whitespace-nowrap text-[rgb(var(--s))] uppercase",
        SEVERITY_TONE[severity],
      )}
    >
      {children}
    </span>
  );
}

/** HTTP status, response time with the 2 s meter, and the finding count per severity. */
export function MetricTiles({ scan }: { scan: ScanDetail }) {
  const ms = scan.responseTimeMs;
  const counts = severityCounts(scan.findings);
  const finished = scan.status === "SUCCEEDED";

  return (
    <div
      className="mt-[18px] grid animate-dash-rise grid-cols-3 gap-3.5 max-[1099px]:grid-cols-1 motion-reduce:animate-none"
      style={riseStyle(2)}
    >
      <div className={TILE}>
        <div className={KEY}>HTTP status</div>
        <div className={cn(VALUE, CODE_COLOR[codeClass(scan.statusCode)])}>
          {scan.statusCode ?? "—"}
        </div>
        <div className={SUB}>{httpStatusText(scan.statusCode, scan.status)}</div>
      </div>

      <div className={TILE}>
        <div className={KEY}>Response time</div>
        <div className={VALUE}>
          {ms != null ? (
            <>
              {ms.toLocaleString("en-US")}
              <small className="font-mono text-[16px] font-medium tracking-normal text-landing-muted">
                ms
              </small>
            </>
          ) : (
            <span className="text-landing-muted">—</span>
          )}
        </div>
        <div aria-hidden="true" className="relative mt-3.5 h-2 rounded-full bg-landing-surface-2">
          <i
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
              isSlow(ms)
                ? "bg-[linear-gradient(90deg,rgb(255_180_84/0.5),var(--color-landing-warn))]"
                : "bg-[linear-gradient(90deg,rgb(124_196_255/0.5),var(--color-landing-info))]",
            )}
            style={{ width: `${ms != null ? meterPercent(ms) : 0}%` }}
          />
          <b
            className="absolute -top-[5px] -bottom-[5px] w-0.5 rounded-sm bg-landing-warn after:absolute after:-top-5 after:left-1/2 after:-translate-x-1/2 after:font-mono after:text-[11px] after:font-normal after:whitespace-nowrap after:text-landing-warn after:content-['2_s']"
            style={{ left: `${METER_TICK_PERCENT}%` }}
          />
        </div>
        <div className={SUB}>
          {ms != null
            ? isSlow(ms)
              ? `Above the ${SLOW_MS.toLocaleString("en-US")} ms slow threshold`
              : `Under the ${SLOW_MS.toLocaleString("en-US")} ms slow threshold`
            : "Not measured"}
        </div>
      </div>

      <div className={TILE}>
        <div className={KEY}>Findings</div>
        <div className={VALUE}>{finished ? scan.findings.length : "—"}</div>
        {counts.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.map(({ severity, count }) => (
              <SeverityPill key={severity} severity={severity}>
                {count} {severity.toLowerCase()}
              </SeverityPill>
            ))}
          </div>
        ) : (
          <div className={SUB}>
            {finished
              ? "Nothing to report"
              : scan.status === "FAILED"
                ? "No result to evaluate"
                : "Evaluated when the scan finishes"}
          </div>
        )}
      </div>
    </div>
  );
}
