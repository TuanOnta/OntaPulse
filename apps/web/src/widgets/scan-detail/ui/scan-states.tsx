import { ButtonLink } from "@/shared/ui/pill-button";
import { StateArt } from "@/shared/ui/state-art";
import { PANEL, PANEL_TEXT, PANEL_TITLE } from "@/shared/ui/state-panel";

const BAR = "block rounded-lg bg-landing-surface-2";
const SHEEN =
  "relative overflow-hidden after:absolute after:inset-0 after:animate-dash-sheen after:-translate-x-full after:bg-[linear-gradient(100deg,transparent_30%,rgb(232_241_236/0.05)_50%,transparent_70%)] after:content-[''] motion-reduce:after:animate-none";

/** The scan does not exist or is not visible to the user (the API answers 404 for both). */
export function ScanNotFound({ backTo, label }: { backTo: string; label: string }) {
  return (
    <div className={PANEL}>
      <StateArt />
      <h2 className={PANEL_TITLE}>Scan not found</h2>
      <p className={PANEL_TEXT}>It may not exist, or you may not be a member of this workspace.</p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-3">
        <ButtonLink to={backTo}>{label}</ButtonLink>
      </div>
    </div>
  );
}

/** Placeholder for the hero and the three metric tiles while the scan loads. */
export function ScanDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading scan" role="status">
      <div
        className={`${SHEEN} flex flex-col gap-3.5 rounded-[28px] border border-landing-border bg-landing-surface/[.78] p-7`}
      >
        <i className={`${BAR} size-24 rounded-full`} />
        <i className={`${BAR} h-5 w-[min(460px,62%)]`} />
        <i className={`${BAR} h-3.5 w-[38%]`} />
      </div>
      <div className="mt-[18px] grid grid-cols-3 gap-3.5 max-[1099px]:grid-cols-1">
        {[0, 1, 2].map((key) => (
          <div
            className={`${SHEEN} flex min-h-[120px] flex-col justify-center gap-3 rounded-[20px] border border-landing-border bg-landing-surface/60 p-5`}
            key={key}
          >
            <i className={`${BAR} h-3.5 w-[38%]`} />
            <i className={`${BAR} h-5 w-[62%]`} />
          </div>
        ))}
      </div>
    </div>
  );
}
