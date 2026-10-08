import { ButtonLink, PlusIcon } from "./buttons";
import { riseStyle } from "./rise";

/** Eyebrow with the pulsing live dot, greeting, subtitle and the "New workspace" button. */
export function OverviewHead({ firstName }: { firstName: string }) {
  return (
    <header
      className="flex animate-dash-rise flex-wrap items-end justify-between gap-5 motion-reduce:animate-none"
      style={riseStyle(0)}
    >
      <div>
        <span className="inline-flex items-center gap-2.5 font-mono text-[13px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase">
          <span
            aria-hidden="true"
            className="size-2 animate-dash-ping rounded-full bg-landing-accent motion-reduce:animate-none"
          />
          Dashboard
        </span>
        <h1 className="mt-2.5 font-display text-[clamp(32px,4vw,46px)] leading-[1.08] font-bold tracking-[-.02em]">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-2 max-w-[52ch] text-[17px] text-landing-muted">
          Your workspaces. Open one to manage its projects, monitors and members.
        </p>
      </div>
      <ButtonLink className="max-[520px]:w-full" to="/workspaces/new">
        <PlusIcon />
        New workspace
      </ButtonLink>
    </header>
  );
}
