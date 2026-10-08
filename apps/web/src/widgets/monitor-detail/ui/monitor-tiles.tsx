import { toast } from "sonner";

import { humanInterval } from "@/entities/monitor";
import { formatDay } from "@/shared/lib/format";
import { riseStyle } from "@/shared/lib/rise";

const CopyIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 20 20" width="16">
    <rect height="9.5" rx="2" stroke="currentColor" strokeWidth="1.5" width="9.5" x="7" y="7" />
    <path
      d="M13 7 V5.5 A2 2 0 0 0 11 3.5 H5.5 A2 2 0 0 0 3.5 5.5 V11 A2 2 0 0 0 5.5 13 H7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </svg>
);

const TILE =
  "relative min-w-0 rounded-[18px] border border-landing-border bg-landing-surface/[.72] px-[18px] py-4";
const KEY =
  "font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase";
const VALUE = "mt-1.5 truncate text-[18px] leading-[normal] font-semibold text-landing-text";
const SUB = "mt-0.5 text-[14px] text-landing-muted";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Target URL copied.");
  } catch {
    toast.error("Could not copy the URL. Select it and copy it manually.");
  }
}

/** Target (with copy), interval, request type and the date the monitor was added. */
export function MonitorTiles({
  targetUrl,
  intervalSeconds,
  createdAt,
  projectName,
}: {
  targetUrl: string;
  intervalSeconds: number;
  createdAt: string;
  projectName: string;
}) {
  const interval = humanInterval(intervalSeconds);
  return (
    <div
      className="mt-[18px] grid animate-dash-rise grid-cols-4 gap-3.5 max-[1099px]:grid-cols-2 max-[520px]:grid-cols-1 motion-reduce:animate-none"
      style={riseStyle(2)}
    >
      <div className={TILE}>
        <div className={KEY}>Target</div>
        <div
          className="mt-1.5 pr-9 text-[15px] leading-[1.35] font-semibold text-landing-text [overflow-wrap:anywhere]"
          title={targetUrl}
        >
          {targetUrl}
        </div>
        <button
          aria-label="Copy target URL"
          className="absolute top-2.5 right-2.5 grid size-9 cursor-pointer place-items-center rounded-[10px] border border-transparent text-landing-muted transition-[background-color,color,border-color] duration-200 hover:border-landing-border hover:bg-landing-surface-2 hover:text-landing-text motion-reduce:transition-none"
          onClick={() => void copyText(targetUrl)}
          type="button"
        >
          <CopyIcon />
        </button>
      </div>
      <div className={TILE}>
        <div className={KEY}>Interval</div>
        <div className={VALUE}>{interval.charAt(0).toUpperCase() + interval.slice(1)}</div>
        <div className={SUB}>{intervalSeconds.toLocaleString("en-US")} seconds</div>
      </div>
      <div className={TILE}>
        <div className={KEY}>Request</div>
        <div className={VALUE}>HTTP GET</div>
        <div className={SUB}>Redirects are not followed</div>
      </div>
      <div className={TILE}>
        <div className={KEY}>Added</div>
        <div className={VALUE}>{formatDay(createdAt)}</div>
        <div className={SUB}>in {projectName}</div>
      </div>
    </div>
  );
}
