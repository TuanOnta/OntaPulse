import { cn } from "cn";

import { runLabel, runTone, type ScanChipTone, type ScanRun } from "../model/scan-run";

const TONE: Record<ScanChipTone, string> = {
  queued: "text-landing-muted [&>i]:animate-pj-blink",
  running: "bg-landing-info/[.08] text-landing-info [&>i]:animate-pj-ping",
  succeeded: "bg-landing-accent/[.07] text-landing-accent",
  warn: "bg-landing-warn/[.08] text-landing-warn",
  failed: "bg-landing-danger/[.08] text-landing-danger-text",
};

/** Scan lifecycle chip: a dot plus the status in words, so it never relies on colour alone. */
export function ScanRunChip({ run }: { run: ScanRun }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 animate-pj-pop items-center gap-2 rounded-full border border-current px-3.5 font-mono text-[12px] leading-[normal] font-medium tracking-[.04em] whitespace-nowrap uppercase motion-reduce:animate-none motion-reduce:[&>i]:animate-none",
        TONE[runTone(run)],
      )}
      role="status"
    >
      <i aria-hidden="true" className="size-2 flex-none rounded-full bg-current" />
      {runLabel(run)}
    </span>
  );
}
