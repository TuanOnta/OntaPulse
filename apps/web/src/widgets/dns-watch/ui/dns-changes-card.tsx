import { DnsChangeEntry, recentChanges } from "@/entities/dns";
import type { DnsBaseline } from "@/shared/types/domain";

/** What changed since the baseline was first recorded: the newest scans that changed a record, newest first. */
export function DnsChangesCard({
  baseline,
  scanHref,
}: {
  baseline: DnsBaseline;
  scanHref: (scanId: string) => string;
}) {
  const { shown, hidden } = recentChanges(baseline.changes);

  return (
    <section
      aria-labelledby="dns-changes-title"
      className="min-w-0 rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]"
    >
      <h3
        className="mb-4 font-display text-[19px] font-bold tracking-[-.01em]"
        id="dns-changes-title"
      >
        Recent changes
      </h3>

      {shown.length === 0 ? (
        <p className="text-landing-text-2">No changes since the baseline was recorded.</p>
      ) : (
        <ul aria-label="Recent DNS changes" className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((entry) => (
            <DnsChangeEntry entry={entry} key={entry.scanId} scanHref={scanHref} />
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <p className="mt-3 text-[14px] text-landing-muted">
          Showing {shown.length} of {shown.length + hidden} changes.
        </p>
      ) : null}
    </section>
  );
}
