import { cn } from "cn";

import type { OrbKind } from "../model/scan-view";

const ARC = "[stroke:rgb(var(--c))] [stroke-linecap:round] [transform-origin:48px_48px]";
const DRAW = `${ARC} [stroke-dasharray:60] [stroke-dashoffset:60] animate-sc-draw motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]`;
const HALO =
  "[fill:rgba(var(--c),0.1)] [transform-origin:48px_48px] animate-sc-halo motion-reduce:animate-none";

/** Status orb of the scan hero. Decorative: the status is always spelled out next to it. */
export function ScanOrb({ kind }: { kind: OrbKind }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-24 flex-none text-[rgb(var(--c))]",
        kind === "failed" && "animate-sc-shake motion-reduce:animate-none",
      )}
      viewBox="0 0 96 96"
    >
      <circle
        className="[stroke:rgba(var(--c),0.2)]"
        cx="48"
        cy="48"
        fill="none"
        r="40"
        strokeWidth="5"
      />
      {kind === "queued" ? (
        <>
          <circle
            className={`${ARC} animate-sc-spin-slow motion-reduce:animate-none`}
            cx="48"
            cy="48"
            fill="none"
            r="40"
            strokeDasharray="2 12"
            strokeWidth="5"
          />
          <circle cx="48" cy="48" fill="currentColor" opacity=".7" r="5" />
        </>
      ) : null}
      {kind === "running" ? (
        <>
          <circle className={HALO} cx="48" cy="48" r="30" />
          <circle
            className={`${ARC} animate-sc-spin motion-reduce:animate-none`}
            cx="48"
            cy="48"
            fill="none"
            r="40"
            strokeDasharray="70 190"
            strokeWidth="5"
          />
          <circle cx="48" cy="48" fill="currentColor" r="5" />
        </>
      ) : null}
      {kind === "ok" || kind === "warn" || kind === "failed" ? (
        <>
          <circle className={HALO} cx="48" cy="48" r="30" />
          <circle className={ARC} cx="48" cy="48" fill="none" r="40" strokeWidth="5" />
        </>
      ) : null}
      {kind === "ok" ? (
        <path
          className={DRAW}
          d="M33 49 L44 60 L64 37"
          fill="none"
          strokeLinejoin="round"
          strokeWidth="6"
        />
      ) : null}
      {kind === "warn" ? (
        <>
          <path className={DRAW} d="M48 30 V52" fill="none" strokeWidth="6" />
          <circle cx="48" cy="65" fill="currentColor" r="3.6" />
        </>
      ) : null}
      {kind === "failed" ? (
        <path className={DRAW} d="M36 36 L60 60 M60 36 L36 60" fill="none" strokeWidth="6" />
      ) : null}
    </svg>
  );
}
