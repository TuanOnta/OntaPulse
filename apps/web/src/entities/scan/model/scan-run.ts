import type { ScanDetail } from "@/shared/types/domain";

export type ScanRunPhase = "queued" | "running" | "succeeded" | "failed";

/** What the project screen knows about a scan it triggered itself. */
export type ScanRun = { phase: ScanRunPhase; findingCount: number };

export type ScanChipTone = "queued" | "running" | "succeeded" | "warn" | "failed";

export const QUEUED_RUN: ScanRun = { phase: "queued", findingCount: 0 };

/** Maps the polled scan (`GET /scans/:id`) to a run. Statuses are real, never guessed. */
export function toScanRun(scan: Pick<ScanDetail, "status" | "findings">): ScanRun {
  switch (scan.status) {
    case "QUEUED":
      return QUEUED_RUN;
    case "RUNNING":
      return { phase: "running", findingCount: 0 };
    case "SUCCEEDED":
      return { phase: "succeeded", findingCount: scan.findings?.length ?? 0 };
    case "FAILED":
      return { phase: "failed", findingCount: 0 };
  }
}

export function isRunBusy(run: ScanRun | undefined): boolean {
  return run?.phase === "queued" || run?.phase === "running";
}

export function isRunFinished(run: ScanRun): boolean {
  return run.phase === "succeeded" || run.phase === "failed";
}

export function runTone(run: ScanRun): ScanChipTone {
  if (run.phase === "succeeded") return run.findingCount > 0 ? "warn" : "succeeded";
  return run.phase;
}

export function runLabel(run: ScanRun): string {
  switch (run.phase) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "succeeded":
      return run.findingCount > 0
        ? `Succeeded · ${run.findingCount} finding${run.findingCount === 1 ? "" : "s"}`
        : "Succeeded · no findings";
  }
}
