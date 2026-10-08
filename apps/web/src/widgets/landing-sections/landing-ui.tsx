import { cn } from "cn";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Where the landing CTAs lead. The interim auth pages are replaced when the auth prototype lands. */
export const AUTH_ROUTES = { login: "/login", register: "/register" } as const;

const BUTTON_BASE =
  "inline-flex min-h-12 items-center rounded-full px-[26px] text-[17px] font-semibold transition-[filter] motion-reduce:transition-none";
const BUTTON_VARIANTS = {
  primary:
    "bg-landing-accent text-landing-accent-ink hover:text-landing-accent-ink hover:brightness-[1.08]",
  ghost:
    "border border-landing-border-strong bg-landing-bg/60 font-medium text-landing-text hover:text-landing-text",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant, className?: string): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

/** Router link styled as a landing button. */
export function LinkButton({
  to,
  variant,
  className,
  children,
}: {
  to: string;
  variant: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link className={buttonClass(variant, className)} to={to}>
      {children}
    </Link>
  );
}

/** In-page anchor styled as a landing button. */
export function AnchorButton({
  href,
  variant,
  children,
}: {
  href: string;
  variant: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <a className={buttonClass(variant)} href={href}>
      {children}
    </a>
  );
}

/**
 * The prototype's CSS rule `main, header.site, .container { max-width: 1200px; margin: 0 auto;
 * padding: 0 32px }` lost part of its selector list, so `main` and the header get the same inset
 * as `.container` and the padding stacks (content column 1072px at 1440). The approved design is
 * the rendered result, so it is reproduced here. Drop this constant if the prototype is corrected.
 */
export const PAGE_INSET = "mx-auto max-w-[1200px] px-8";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(PAGE_INSET, className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12px] tracking-[.08em] text-landing-accent uppercase">
      {children}
    </span>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      className="font-display text-[clamp(32px,4vw,52px)] leading-[1.08] font-bold tracking-[-.02em]"
      id={id}
    >
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-landing-text-2">{children}</p>;
}

export function Dot() {
  return <span className="inline-block size-2 rounded-full bg-landing-accent" />;
}
