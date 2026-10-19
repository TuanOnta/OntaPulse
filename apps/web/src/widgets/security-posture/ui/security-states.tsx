import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";

/** Placeholder while the settings or the latest result load. */
export function SecuritySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading security result"
      className="h-40 animate-pulse rounded-[22px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
      role="status"
    />
  );
}

/** No security scan yet, or the checks are off. Explains how a scan starts; never a score of zero. */
export function SecurityEmpty({ enabled, canManage }: { enabled: boolean; canManage: boolean }) {
  return (
    <div className={PANEL}>
      <h3 className={PANEL_TITLE}>
        {enabled ? "No security scan yet" : "Security checks are off"}
      </h3>
      <p className={PANEL_TEXT}>
        {enabled
          ? canManage
            ? "No security scan yet. Run one to see what is observed on this host."
            : "No security scan yet. An owner or admin can run the first one."
          : canManage
            ? "Security checks are off. Turn them on to observe headers, cookies, CORS, redirects, and TLS."
            : "Security checks are off. An owner or admin can turn them on."}
      </p>
    </div>
  );
}
