import type { EdgeDetection } from "@/shared/types/domain";

import { confidenceText, layerLabel, signalText, vendorLabel } from "../model/edge-profile-labels";

const PILL =
  "inline-flex min-h-7 items-center self-start rounded-full border border-landing-border-strong bg-landing-surface-2/60 px-3 font-mono text-[12px] leading-[normal] font-semibold tracking-[.08em] whitespace-nowrap text-landing-text-2 uppercase";

/**
 * One observed edge layer. Layer and confidence are words in neutral pills: an edge layer is information,
 * never a defect, so it uses none of the severity colours.
 */
export function EdgeDetectionRow({ detection }: { detection: EdgeDetection }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-[18px] border border-landing-border bg-landing-surface/[.72] px-5 py-4">
      <div className="min-w-0">
        <p className="font-display text-[18px] font-bold tracking-[-.01em]">
          {vendorLabel(detection.vendor)}
        </p>
        {detection.signals.length > 0 ? (
          <p className="mt-1 text-[14px] break-words text-landing-muted">
            Signals: {detection.signals.map(signalText).join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 max-[520px]:w-full">
        <span className={PILL}>{layerLabel(detection.layer)}</span>
        <span className={PILL}>{confidenceText(detection.confidence)}</span>
      </div>
    </li>
  );
}
