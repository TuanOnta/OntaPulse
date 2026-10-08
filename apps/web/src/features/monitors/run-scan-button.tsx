import { ActionButton, SMALL_PILL } from "@/shared/ui/pill-button";

const PlayIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path d="M4.5 3 L12.5 8 L4.5 13 Z" fill="currentColor" />
  </svg>
);

/** "Run scan" for one monitor. Disabled while that monitor's scan is queued or running. */
export function RunScanButton({
  host,
  busy,
  onRun,
}: {
  host: string;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <ActionButton
      aria-label={`Run scan for ${host}`}
      className={SMALL_PILL}
      disabled={busy}
      onClick={onRun}
      variant="ghost"
    >
      <PlayIcon />
      Run scan
    </ActionButton>
  );
}
