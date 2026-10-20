import { Link } from "react-router-dom";

import { EdgeDetectionRow, sortDetections, supportedVendorsText } from "@/entities/edge-profile";
import { formatFull } from "@/shared/lib/format";
import { LoadErrorBanner } from "@/shared/ui/state-panel";
import { cn } from "cn";

import { useEdgeProfile } from "../model/use-edge-profile";

/**
 * Edge layers (CDN, WAF, anti-bot) observed in front of the host, from the newest security scan. Read only and
 * informational: it never uses severity styling. It loads on its own, so a failure here never hides the scan result.
 */
export function EdgeProfileCard({
  monitorId,
  scanId,
  scanHref,
  onlyForScan = false,
  className,
}: {
  monitorId: string;
  /** The newest security scan (or the scan on screen); a new id refetches the profile. */
  scanId: string;
  /** Where "Open the scan" points. Not used on a scan screen, where the link would point at itself. */
  scanHref?: (scanId: string) => string;
  /**
   * On a scan screen: the profile is the monitor's current one, so show it only when this very scan produced
   * it (an older scan page shows nothing instead of a profile that belongs to a later scan), and without a
   * link back to the scan.
   */
  onlyForScan?: boolean;
  className?: string;
}) {
  const edge = useEdgeProfile(monitorId, scanId);

  if (
    onlyForScan &&
    (edge.status === "empty" || (edge.status === "ready" && edge.profile.scanId !== scanId))
  ) {
    return null;
  }

  return (
    <section
      aria-labelledby="edge-title"
      className={cn(
        "rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]",
        className,
      )}
    >
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="font-display text-[19px] font-bold tracking-[-.01em]" id="edge-title">
          Edge layers
        </h3>
        {edge.status === "ready" ? (
          <p className="text-[15px] text-landing-muted">
            Observed {formatFull(edge.profile.observedAt)}
            {!onlyForScan && scanHref ? (
              <>
                {" "}
                ·{" "}
                <Link
                  className="text-landing-accent underline underline-offset-4"
                  to={scanHref(edge.profile.scanId)}
                >
                  Open the scan
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {edge.status === "loading" ? (
        <div
          aria-busy="true"
          aria-label="Loading edge layers"
          className="h-20 animate-pulse rounded-[18px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
          role="status"
        />
      ) : edge.status === "error" ? (
        <LoadErrorBanner
          message={edge.error.message}
          onRetry={edge.reload}
          requestId={edge.error.requestId}
          title="Couldn’t load the edge layers."
        />
      ) : edge.status === "empty" ? (
        <p className="text-landing-text-2">
          No edge profile yet. The next security scan records one.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {edge.profile.challengeObserved ? (
            <p className="rounded-[14px] border border-landing-border-strong bg-landing-surface-2/60 px-4 py-3 text-[15px] text-landing-text-2">
              A challenge page was served to the scanner. Security findings from that response were
              skipped.
            </p>
          ) : null}

          {edge.profile.detections.length === 0 ? (
            <>
              <p className="text-landing-text-2">
                No CDN, WAF, or anti-bot layer was observed in the last scan.
              </p>
              <p className="text-[14px] text-landing-muted">
                Recognised services: {supportedVendorsText()}. A host behind any other edge service
                shows nothing here.
              </p>
            </>
          ) : (
            <ul aria-label="Observed edge layers" className="m-0 flex list-none flex-col gap-3 p-0">
              {sortDetections(edge.profile.detections).map((detection) => (
                <EdgeDetectionRow
                  detection={detection}
                  key={`${detection.vendor}-${detection.layer}`}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
