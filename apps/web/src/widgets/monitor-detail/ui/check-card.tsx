import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

import { SeverityPill } from "@/entities/finding";
import { relativeTime } from "@/entities/scan";
import { cn } from "cn";

import type { CheckSummary } from "../model/check-summary";

export const CHECK_TAB = ["overview", "security", "dns"] as const;
export type CheckTab = (typeof CHECK_TAB)[number];

/** What the card says about a security or DNS result, in words as well as pills. */
export function CheckSummaryText({
  summary,
  now,
  canManage,
  noun,
}: {
  summary: CheckSummary;
  now: number;
  canManage: boolean;
  noun: string;
}) {
  switch (summary.state) {
    case "loading":
      return (
        <span
          aria-busy="true"
          aria-label={`Loading ${noun} status`}
          className="block h-12 animate-pulse rounded-xl bg-landing-surface-2/60 motion-reduce:animate-none"
          role="status"
        />
      );
    case "error":
      return (
        <>
          <span className="block text-[16px] font-semibold text-landing-danger-text">
            Couldn’t load
          </span>
          <span className="mt-0.5 block text-[14px] text-landing-muted">Open the tab to retry</span>
        </>
      );
    case "off":
      return (
        <>
          <span className="block text-[16px] font-semibold text-landing-muted">Off</span>
          <span className="mt-0.5 block text-[14px] text-landing-muted">
            {canManage ? `Turn on ${noun} to start checking` : "An owner or admin can turn it on"}
          </span>
        </>
      );
    case "empty":
      return (
        <>
          <span className="block text-[16px] font-semibold">No scan yet</span>
          <span className="mt-0.5 block text-[14px] text-landing-muted">
            {canManage ? "Run the first scan" : "An owner or admin runs the first scan"}
          </span>
        </>
      );
    case "failed":
      return (
        <>
          <span className="block text-[16px] font-semibold text-landing-danger-text">
            Last scan failed
          </span>
          <span className="mt-0.5 block text-[14px] text-landing-muted">
            {relativeTime(summary.checkedAt, now)}
          </span>
        </>
      );
    case "ready":
      return (
        <>
          <span className="flex flex-wrap items-center gap-1.5 text-[16px] font-semibold">
            {summary.counts.length === 0 ? (
              <span>No findings observed</span>
            ) : (
              summary.counts.map(({ severity, count }) => (
                <SeverityPill key={severity} severity={severity}>
                  {count} {severity.toLowerCase()}
                </SeverityPill>
              ))
            )}
          </span>
          <span className="mt-1 block text-[14px] text-landing-muted">
            Checked {relativeTime(summary.checkedAt, now)}
          </span>
        </>
      );
  }
}

/**
 * One check of the strip. The whole card is the tab (an overlay on the trigger), while the controls in the
 * footer sit above it, so using the switch or Run never changes the panel. The selected card is joined to the
 * panel with a small notch.
 */
export function CheckCard({
  value,
  name,
  stateLabel,
  icon,
  children,
  footer,
}: {
  value: CheckTab;
  name: string;
  stateLabel: string;
  icon: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/card relative flex min-w-0 flex-col gap-3.5 rounded-[22px] border border-landing-border bg-landing-surface/[.72] px-5 py-[18px] transition-[border-color,background-color] duration-200 hover:border-landing-border-hover motion-reduce:transition-none",
        "has-data-[state=active]:border-landing-accent/55 has-data-[state=active]:bg-landing-surface-2/90 has-data-[state=active]:shadow-[0_18px_40px_-22px_rgb(94_242_160/0.35)]",
        "has-data-[state=active]:after:absolute has-data-[state=active]:after:-bottom-[15px] has-data-[state=active]:after:left-1/2 has-data-[state=active]:after:size-3.5 has-data-[state=active]:after:-translate-x-1/2 has-data-[state=active]:after:rotate-45 has-data-[state=active]:after:rounded-br-[4px] has-data-[state=active]:after:border-r has-data-[state=active]:after:border-b has-data-[state=active]:after:border-landing-accent/55 has-data-[state=active]:after:bg-landing-surface-2 has-data-[state=active]:after:content-[''] max-[1279px]:has-data-[state=active]:after:hidden",
      )}
    >
      <Tabs.Trigger
        className="flex cursor-pointer flex-col gap-3.5 rounded-xl text-left outline-none after:absolute after:inset-0 after:rounded-[22px] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-landing-accent focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-landing-bg"
        value={value}
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 flex-none place-items-center rounded-xl border border-landing-border-strong bg-landing-bg-2 text-landing-text group-has-data-[state=active]/card:border-landing-accent/40 group-has-data-[state=active]/card:text-landing-accent"
          >
            {icon}
          </span>
          <span className="font-display text-[18px] font-bold tracking-[-.01em]">{name}</span>
          <span className="ml-auto whitespace-nowrap font-mono text-[12px] leading-[normal] font-medium tracking-[.06em] text-landing-muted uppercase">
            {stateLabel}
          </span>
        </span>
        <span className="block min-h-[3.1em]">{children}</span>
      </Tabs.Trigger>
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-t border-landing-border pt-3">
        {footer}
      </div>
    </div>
  );
}
