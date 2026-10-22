import { severityCounts } from "@/entities/scan";
import type { FindingSeverity, ScanDetail } from "@/shared/types/domain";

type Latest =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; scan: ScanDetail };

export type CheckSummary =
  | { state: "loading" }
  | { state: "error" }
  | { state: "off" }
  | { state: "empty" }
  | { state: "failed"; checkedAt: string }
  | {
      state: "ready";
      checkedAt: string;
      findings: number;
      counts: { severity: FindingSeverity; count: number }[];
    };

/**
 * What a check card says about the latest stored result. The switch wins over an old result: a check that is
 * off reads "Off" even if it ran before, so the card never suggests it is still being watched.
 */
export function summarizeCheck(
  settings: "loading" | "ready" | "error",
  enabled: boolean,
  latest: Latest,
): CheckSummary {
  if (settings === "loading" || latest.status === "loading") return { state: "loading" };
  if (settings === "error" || latest.status === "error") return { state: "error" };
  if (!enabled) return { state: "off" };
  if (latest.status === "empty") return { state: "empty" };
  const checkedAt = latest.scan.finishedAt ?? latest.scan.createdAt;
  if (latest.scan.status === "FAILED") return { state: "failed", checkedAt };
  return {
    state: "ready",
    checkedAt,
    findings: latest.scan.findings.length,
    counts: severityCounts(latest.scan.findings),
  };
}

/**
 * One line about every stored result together, in "observed" wording. Nothing while a result still loads or
 * when no check has a result, so the header never claims health it has not seen.
 */
export function overallLine(summaries: readonly CheckSummary[]): string | null {
  if (summaries.some((summary) => summary.state === "loading")) return null;
  const ready = summaries.filter((summary) => summary.state === "ready");
  if (ready.length === 0) return null;
  const total = ready.reduce((sum, summary) => sum + summary.findings, 0);
  return total === 0
    ? "No findings observed"
    : `${total} finding${total === 1 ? "" : "s"} observed`;
}
