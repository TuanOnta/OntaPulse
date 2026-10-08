import { cn } from "cn";
import { Link } from "react-router-dom";

import { AUTH_ROUTES, Container, LinkButton, PAGE_INSET } from "./landing-ui";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#result", label: "Scan results" },
  { href: "#features", label: "Features" },
] as const;

const NAV_LINK =
  "inline-flex min-h-11 items-center text-landing-muted transition-colors hover:text-landing-text motion-reduce:transition-none max-[640px]:hidden";

export function LandingHeader() {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b border-landing-border bg-landing-bg/[.72] backdrop-blur-[10px]",
        PAGE_INSET,
      )}
    >
      <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3.5">
        <a
          className="inline-flex min-h-11 items-center gap-2.5 font-display text-[22px] font-bold text-landing-text hover:text-landing-text"
          href="#top"
        >
          <svg aria-hidden="true" height="30" viewBox="0 0 30 30" width="30">
            <circle
              className="stroke-landing-accent"
              cx="15"
              cy="15"
              fill="none"
              r="13"
              strokeOpacity=".5"
              strokeWidth="1.5"
            />
            <path
              className="stroke-landing-accent"
              d="M3 16 H10 L13 8 L17 23 L20 16 H27"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          OntaPulse
        </a>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {NAV_LINKS.map((link) => (
            <a className={NAV_LINK} href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
          <Link
            className="inline-flex min-h-11 items-center text-landing-text hover:text-landing-text"
            to={AUTH_ROUTES.login}
          >
            Sign in
          </Link>
          <LinkButton
            className="min-h-11 px-5 text-[16px]"
            to={AUTH_ROUTES.register}
            variant="primary"
          >
            Get started
          </LinkButton>
        </nav>
      </Container>
    </header>
  );
}
