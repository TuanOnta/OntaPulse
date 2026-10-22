import { DnsRecordList, hostRows, organizationRows } from "@/entities/dns";
import { formatFull } from "@/shared/lib/format";
import type { DnsBaseline } from "@/shared/types/domain";

/**
 * The stored snapshot: the records of the host and of its organizational domain, exactly as the last successful
 * scan observed them. It is the reference every later scan is compared with.
 */
export function DnsBaselineCard({ baseline }: { baseline: DnsBaseline }) {
  return (
    <section
      aria-labelledby="dns-baseline-title"
      className="min-w-0 rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          className="font-display text-[19px] font-bold tracking-[-.01em]"
          id="dns-baseline-title"
        >
          Baseline
        </h3>
        <p className="text-[14px] text-landing-muted">Observed {formatFull(baseline.observedAt)}</p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h4 className="mb-3 font-mono text-[13px] leading-[normal] break-all text-landing-text">
            {baseline.snapshot.host.name || baseline.host}
          </h4>
          <DnsRecordList label="Records of the host" rows={hostRows(baseline.snapshot)} />
        </div>
        <div>
          <h4 className="mb-1 font-mono text-[13px] leading-[normal] break-all text-landing-text">
            {baseline.snapshot.organization.name || baseline.organizationDomain}
          </h4>
          <p className="mb-3 text-[14px] text-landing-muted">Organizational domain</p>
          <DnsRecordList
            label="Records of the organizational domain"
            rows={organizationRows(baseline.snapshot)}
          />
        </div>
      </div>
    </section>
  );
}
