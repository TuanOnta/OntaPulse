import { Link } from "react-router-dom";

import { FindingCard, SeverityPill } from "@/entities/finding";
import { SubCheckList, severityCounts, sortFindings, subCheckCounts } from "@/entities/scan";
import { formatFull } from "@/shared/lib/format";
import type { ScanDetail } from "@/shared/types/domain";
import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";

/** The latest finished security scan: when, what was observed, which checks ran. */
export function SecurityResult({ scan, scanHref }: { scan: ScanDetail; scanHref: string }) {
  const when = formatFull(scan.finishedAt ?? scan.createdAt);

  if (scan.status === "FAILED") {
    return (
      <div className={PANEL}>
        <h3 className={PANEL_TITLE}>The last security scan could not complete</h3>
        <p className={PANEL_TEXT}>
          {scan.errorMessage || "The target could not be reached."} Checked {when}.
        </p>
        <Link className="text-landing-accent underline underline-offset-4" to={scanHref}>
          Open the scan
        </Link>
      </div>
    );
  }

  const findings = sortFindings(scan.findings);
  const counts = severityCounts(findings);
  const { ran, skipped } = subCheckCounts(scan.subChecks);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[15px] text-landing-muted">
          Last checked {when} · {findings.length} finding{findings.length === 1 ? "" : "s"} observed
          · {ran} check{ran === 1 ? "" : "s"} ran
          {skipped > 0 ? `, ${skipped} skipped` : ""}
        </p>
        <Link
          className="text-[15px] text-landing-accent underline underline-offset-4"
          to={scanHref}
        >
          Open the scan
        </Link>
      </div>

      {counts.length > 0 ? (
        <div aria-label="Findings by severity" className="flex flex-wrap gap-2" role="group">
          {counts.map(({ severity, count }) => (
            <SeverityPill key={severity} severity={severity}>
              {count} {severity.toLowerCase()}
            </SeverityPill>
          ))}
        </div>
      ) : null}

      {findings.length === 0 ? (
        <p className="rounded-[18px] border border-landing-accent/30 bg-landing-accent/5 px-5 py-4 text-landing-text-2">
          Nothing was flagged in the checks that ran.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {findings.map((finding, index) => (
            <FindingCard finding={finding} index={index} key={finding.id} />
          ))}
        </ul>
      )}

      {scan.subChecks && scan.subChecks.length > 0 ? (
        <div className="rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]">
          <h3 className="mb-3.5 font-display text-[19px] font-bold tracking-[-.01em]">
            Checks in this scan
          </h3>
          <SubCheckList subChecks={scan.subChecks} />
        </div>
      ) : null}
    </div>
  );
}
