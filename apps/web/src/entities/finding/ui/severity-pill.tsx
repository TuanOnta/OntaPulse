import { cn } from "cn";

/** Accent per severity (an `r,g,b` triple used as `--s`). The pill always carries the severity in words. */
export const SEVERITY_TONE = {
  LOW: "[--s:147,165,156]",
  MEDIUM: "[--s:255,180,84]",
  HIGH: "[--s:255,122,107]",
  CRITICAL: "[--s:255,92,120]",
} as const;

export function SeverityPill({
  severity,
  children,
}: {
  severity: keyof typeof SEVERITY_TONE;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center self-start rounded-full border border-[rgba(var(--s),0.6)] bg-[rgba(var(--s),0.1)] px-3 font-mono text-[12px] leading-[normal] font-semibold tracking-[.08em] whitespace-nowrap text-[rgb(var(--s))] uppercase",
        SEVERITY_TONE[severity],
      )}
    >
      {children}
    </span>
  );
}
