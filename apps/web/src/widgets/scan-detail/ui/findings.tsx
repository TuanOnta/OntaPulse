import { findingCopy, sortFindings } from "@/entities/scan";
import { riseStyle } from "@/shared/lib/rise";
import type { ScanDetail } from "@/shared/types/domain";
import { cn } from "cn";

import { SeverityPill } from "./metric-tiles";

const SEVERITY_TONE = {
  LOW: "[--s:147,165,156]",
  MEDIUM: "[--s:255,180,84]",
  HIGH: "[--s:255,122,107]",
  CRITICAL: "[--s:255,92,120]",
} as const;

const CODE_CHIP =
  "mt-2.5 inline-block rounded-[7px] border border-landing-border bg-landing-bg px-[9px] py-[3px] font-mono text-[13px] leading-[normal] text-landing-muted";

function Head({ children }: { children: string }) {
  return (
    <div
      className="mt-[30px] mb-3.5 flex animate-dash-rise flex-wrap items-baseline justify-between gap-x-3.5 gap-y-2 motion-reduce:animate-none"
      style={riseStyle(4)}
    >
      <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="findings-title">
        Findings
      </h2>
      <p className="text-[15px] text-landing-muted">{children}</p>
    </div>
  );
}

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className="flex-none text-landing-accent"
    fill="none"
    height="40"
    viewBox="0 0 24 24"
    width="40"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M7.5 12.4 L10.6 15.4 L16.5 9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const AlertIcon = () => (
  <svg
    aria-hidden="true"
    className="mt-[3px] flex-none text-landing-danger-text"
    fill="none"
    height="28"
    viewBox="0 0 20 20"
    width="28"
  >
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M10 6 V11 M10 13.6 V14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
);

/** Findings of the scan, or the panel that explains why there are none yet. */
export function Findings({ scan }: { scan: ScanDetail }) {
  return (
    <section aria-labelledby="findings-title">
      <FindingsBody scan={scan} />
    </section>
  );
}

function FindingsBody({ scan }: { scan: ScanDetail }) {
  if (scan.status === "QUEUED" || scan.status === "RUNNING") {
    return (
      <>
        <Head>Evaluated when the scan finishes</Head>
        <div className="rounded-[22px] border border-dashed border-landing-border-strong p-7 text-center text-landing-muted">
          <strong className="mb-1.5 block font-display text-[20px] font-bold text-landing-text">
            Findings will appear here
          </strong>
          This page updates by itself while the scan is in progress.
        </div>
      </>
    );
  }
  if (scan.status === "FAILED") {
    return (
      <>
        <Head>Not evaluated</Head>
        <div className="flex gap-[18px] rounded-[22px] border border-landing-danger/40 bg-landing-danger/[.06] p-6 max-[640px]:flex-col">
          <AlertIcon />
          <div>
            <h3 className="font-display text-[21px] font-bold [overflow-wrap:anywhere]">
              {scan.errorMessage || "The check could not complete."}
            </h3>
            <p className="mt-1.5 max-w-[66ch] text-landing-text-2">
              A scan fails on timeouts, DNS errors and connection failures. There is no HTTP result
              to evaluate, and failed scans are not retried automatically. Check the target is
              reachable from the public internet, then run the scan again.
            </p>
          </div>
        </div>
      </>
    );
  }
  if (scan.findings.length === 0) {
    return (
      <>
        <Head>0 issues from this scan</Head>
        <div className="flex items-center gap-[18px] rounded-[22px] border border-landing-accent/30 bg-landing-accent/5 p-7 max-[640px]:flex-col max-[640px]:items-start">
          <CheckIcon />
          <div>
            <h3 className="font-display text-[21px] font-bold">No findings</h3>
            <p className="mt-1 text-landing-text-2">
              {scan.statusCode != null && scan.responseTimeMs != null
                ? `The target answered with HTTP ${scan.statusCode} in ${scan.responseTimeMs.toLocaleString("en-US")} ms. No client error, server error or slow response was detected.`
                : "The target answered. No client error, server error or slow response was detected."}
            </p>
          </div>
        </div>
      </>
    );
  }
  const list = sortFindings(scan.findings);
  return (
    <>
      <Head>{`${list.length} issue${list.length > 1 ? "s" : ""} found, most severe first`}</Head>
      <div className="flex flex-col gap-3">
        {list.map((finding, index) => {
          const copy = findingCopy(finding, scan);
          return (
            <article
              className={cn(
                "relative grid animate-dash-rise grid-cols-[auto_minmax(0,1fr)] gap-[18px] overflow-hidden rounded-[20px] border border-landing-border bg-landing-surface/[.78] py-5 pr-[22px] pl-[26px] [animation-fill-mode:backwards] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[rgb(var(--s))] before:shadow-[0_0_20px_rgba(var(--s),0.6)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(60%_140%_at_0%_50%,rgba(var(--s),0.08),transparent_70%)] after:content-[''] max-[640px]:grid-cols-1 max-[640px]:gap-2.5 motion-reduce:animate-none",
                SEVERITY_TONE[finding.severity],
              )}
              key={finding.id}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <SeverityPill severity={finding.severity}>{finding.severity}</SeverityPill>
              <div className="relative z-[1] min-w-0">
                <h3 className="font-display text-[20px] font-bold tracking-[-.01em]">
                  {copy.title}
                </h3>
                <p className="mt-1.5 max-w-[70ch] text-[16px] text-landing-text-2">{copy.text}</p>
                <code className={CODE_CHIP}>{finding.code}</code>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
