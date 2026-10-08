import { cn } from "cn";
import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

/** Pill buttons from the dashboard and workspace prototypes (also re-exported by the overview widget). */
const BASE =
  "relative inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-full px-[22px] text-[16px] leading-[normal] font-semibold transition-[transform,box-shadow,background-color] duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";
const VARIANT = {
  primary:
    "bg-landing-accent text-landing-accent-ink after:pointer-events-none after:absolute after:inset-0 after:-translate-x-[120%] after:bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.55)_50%,transparent_65%)] hover:shadow-[0_0_0_4px_rgb(94_242_160/0.12),0_8px_22px_-10px_rgb(94_242_160/0.4)] hover:after:translate-x-[120%] hover:after:transition-transform hover:after:duration-700 motion-reduce:after:hidden",
  ghost:
    "border border-landing-border-strong bg-transparent text-landing-text hover:bg-landing-surface",
  danger:
    "border border-landing-danger/40 bg-transparent text-landing-danger-text hover:bg-landing-danger/10",
  dangerSolid:
    "bg-landing-danger text-landing-danger-ink hover:shadow-[0_0_0_4px_rgb(255_122_107/0.18)] disabled:bg-landing-danger/25 disabled:text-white/50 disabled:opacity-100 disabled:shadow-none",
} as const;

export const SMALL_PILL = "min-h-10 px-4 text-[14px]";

export type OverviewButtonVariant = keyof typeof VARIANT;

export function overviewButtonClass(variant: OverviewButtonVariant, className?: string) {
  return cn(BASE, VARIANT[variant], className);
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: OverviewButtonVariant }) {
  return <Link className={overviewButtonClass(variant, className)} {...props} />;
}

export function ActionButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: OverviewButtonVariant }) {
  return <button className={overviewButtonClass(variant, className)} type="button" {...props} />;
}

export const PlusIcon = ({ size = 18, stroke = 2 }: { size?: number; stroke?: number }) => (
  <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 20 20" width={size}>
    <path
      d="M10 4 V16 M4 10 H16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={stroke}
    />
  </svg>
);
