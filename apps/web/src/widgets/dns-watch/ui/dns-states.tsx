import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";

/** Placeholder while the settings or the latest result load. */
export function DnsSkeleton({ label = "Loading DNS result" }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="h-40 animate-pulse rounded-[22px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
      role="status"
    />
  );
}

/** No DNS scan yet, or DNS watch is off. Explains how a scan starts; never a made-up result. */
export function DnsEmpty({ enabled, canManage }: { enabled: boolean; canManage: boolean }) {
  return (
    <div className={PANEL}>
      <h3 className={PANEL_TITLE}>{enabled ? "No DNS scan yet" : "DNS watch is off"}</h3>
      <p className={PANEL_TEXT}>
        {enabled
          ? canManage
            ? "Run a DNS scan to record the DNS records of this host as a baseline and check its email authentication."
            : "No DNS scan yet. An owner or admin can run the first one."
          : canManage
            ? "Turn on DNS watch to record the DNS records of this host, watch them for changes, and check SPF, DMARC, and DKIM."
            : "DNS watch is off. An owner or admin can turn it on."}
      </p>
    </div>
  );
}
