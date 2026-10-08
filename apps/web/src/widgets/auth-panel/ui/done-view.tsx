import { staggerStyle } from "@/features/auth";

const REDIRECT_PATH = "/dashboard";

/** Signed-in state: the check draws itself, rings pulse outward, a short bar fills. */
export function DoneView({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-start gap-4 pt-2 pb-1" role="status">
      <span
        aria-hidden="true"
        className="relative inline-flex size-14 animate-auth-pop items-center justify-center rounded-full border-[1.5px] border-landing-accent bg-landing-accent/10 motion-reduce:animate-none"
      >
        <i className="absolute -inset-px animate-auth-ring rounded-full border-[1.5px] border-landing-accent opacity-0 motion-reduce:hidden" />
        <i className="absolute -inset-px animate-auth-ring-late rounded-full border-[1.5px] border-landing-accent opacity-0 motion-reduce:hidden" />
        <svg fill="none" height="26" viewBox="0 0 26 26" width="26">
          <path
            className="animate-auth-draw stroke-landing-accent [stroke-dasharray:1] [stroke-dashoffset:1] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            d="M5 13.5 L10.5 19 L21 7.5"
            pathLength={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        </svg>
      </span>
      <div
        className="flex animate-auth-rise-slow flex-col gap-2 motion-reduce:animate-none"
        style={staggerStyle(0)}
      >
        <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-[-.02em]">
          {title}
        </h1>
        <p className="text-[16px] text-landing-text-2">Taking you to your dashboard…</p>
      </div>
      <div
        aria-hidden="true"
        className="h-[3px] w-full overflow-hidden rounded-[3px] bg-landing-border"
      >
        <span className="block h-full w-full origin-left animate-auth-fill bg-landing-accent motion-reduce:animate-none" />
      </div>
      <span className="font-mono text-[13px] leading-[normal] text-landing-muted">
        {REDIRECT_PATH}
      </span>
    </div>
  );
}
