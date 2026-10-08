import { staggerStyle } from "./auth-field";

type Props = {
  busy: boolean;
  label: string;
  busyLabel: string;
  index: number;
};

export function SubmitButton({ busy, label, busyLabel, index }: Props) {
  return (
    <button
      aria-busy={busy}
      className="relative inline-flex min-h-[52px] animate-auth-rise cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-full bg-landing-accent text-[17px] font-semibold text-landing-accent-ink transition-[filter,transform] duration-150 after:pointer-events-none after:absolute after:inset-0 after:-translate-x-[130%] after:bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.5)_50%,transparent_70%)] hover:not-disabled:brightness-[1.08] hover:not-disabled:after:translate-x-[130%] hover:not-disabled:after:transition-transform hover:not-disabled:after:duration-[800ms] active:not-disabled:scale-[0.985] disabled:cursor-progress disabled:opacity-85 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:after:hidden"
      disabled={busy}
      style={staggerStyle(index)}
      type="submit"
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="size-[18px] animate-auth-spin rounded-full border-2 border-landing-accent-ink/30 border-t-landing-accent-ink motion-reduce:animate-[auth-spin_2.4s_linear_infinite]"
          />
          <span>{busyLabel}</span>
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-[3px] w-2/5 animate-auth-indeterminate rounded-sm bg-landing-accent-ink/55 motion-reduce:hidden"
          />
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
