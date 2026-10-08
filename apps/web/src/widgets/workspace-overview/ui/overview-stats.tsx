import type { CSSProperties } from "react";

import type { WorkspaceSummary } from "@/entities/workspace";
import { useCountUp } from "@/shared/lib/use-count-up";

import { riseStyle } from "./rise";

type StatProps = { label: string; value: number; share: number; color: string };

function Stat({ label, value, share, color }: StatProps) {
  const shown = useCountUp(value);
  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-landing-border bg-landing-surface/[.72] px-5 py-[18px] before:absolute before:top-0 before:left-0 before:h-0.5 before:w-[var(--w)] before:bg-[linear-gradient(90deg,var(--c),transparent)] before:content-[''] max-[959px]:p-3.5"
      style={{ "--w": `${share}%`, "--c": color } as CSSProperties}
    >
      <div className="font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase max-[959px]:text-[11px]">
        {label}
      </div>
      <div
        aria-label={`${label}: ${value}`}
        className="mt-1.5 font-display text-[38px] leading-none font-bold tracking-[-.02em] tabular-nums max-[959px]:text-[30px]"
        role="text"
      >
        {shown}
      </div>
    </div>
  );
}

/** Three counts derived from the workspace list (the API offers no other aggregates). */
export function OverviewStats({ summary }: { summary: WorkspaceSummary }) {
  const share = (part: number) => (summary.total ? (part / summary.total) * 100 : 0);
  return (
    <div
      className="grid animate-dash-rise grid-cols-3 gap-3.5 motion-reduce:animate-none max-[959px]:gap-2.5"
      style={riseStyle(2)}
    >
      <Stat
        color="var(--color-landing-text-2)"
        label="Workspaces"
        share={100}
        value={summary.total}
      />
      <Stat
        color="var(--color-landing-info)"
        label="You own"
        share={share(summary.owned)}
        value={summary.owned}
      />
      <Stat
        color="var(--color-landing-warn)"
        label="Shared with you"
        share={share(summary.shared)}
        value={summary.shared}
      />
    </div>
  );
}
