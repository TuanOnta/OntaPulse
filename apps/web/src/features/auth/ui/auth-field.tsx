import { cn } from "cn";
import type { CSSProperties, ReactNode } from "react";

/** Field input styling shared by the login and register forms (auth prototype `.input`). */
export const AUTH_INPUT_CLASS =
  "min-h-[52px] w-full rounded-[14px] border border-landing-border-strong bg-landing-bg-2 pr-4 pl-[46px] text-[17px] text-landing-text transition-[border-color,box-shadow] duration-200 placeholder:text-landing-placeholder hover:border-landing-border-hover focus-visible:border-landing-accent focus-visible:shadow-[0_0_0_3px_rgb(94_242_160/0.22)] focus-visible:outline-none aria-invalid:animate-auth-nudge aria-invalid:border-landing-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_rgb(255_122_107/0.22)] motion-reduce:animate-none";

export const AUTH_PASSWORD_INPUT_CLASS = cn(AUTH_INPUT_CLASS, "pr-[76px]");

export const AUTH_TOGGLE_CLASS =
  "text-landing-muted transition-colors hover:bg-landing-surface-2 hover:text-landing-text";

/** Delay of the staggered rise, in steps of 55 ms (matches the prototype's `--i`). */
export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${index * 55}ms` };
}

type Props = {
  id: string;
  label: string;
  /** Leading icon (decorative). */
  icon: ReactNode;
  error?: string;
  index: number;
  children: ReactNode;
  /** Extra content between the control and the error (password meter, rule hint). */
  below?: ReactNode;
};

export function AuthField({ id, label, icon, error, index, children, below }: Props) {
  return (
    <div
      className="flex animate-auth-rise flex-col gap-2 motion-reduce:animate-none"
      style={staggerStyle(index)}
    >
      <label className="text-[15px] font-medium text-landing-text" htmlFor={id}>
        {label}
      </label>
      <div className="group relative after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:scale-x-0 after:rounded-sm after:bg-gradient-to-r after:from-transparent after:via-landing-accent after:to-transparent after:transition-transform after:duration-[400ms] after:ease-[cubic-bezier(.2,.8,.2,1)] focus-within:after:scale-x-100 motion-reduce:after:transition-none">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-[26px] left-4 -mt-2.5 size-5 text-landing-muted transition-[color,transform] duration-300 group-focus-within:scale-[1.12] group-focus-within:text-landing-accent motion-reduce:transition-none"
        >
          {icon}
        </span>
        {children}
      </div>
      {below}
      {error ? (
        <p
          className="flex animate-auth-fade-up items-center gap-2 text-[14px] text-landing-danger-text before:inline-flex before:size-4 before:flex-none before:items-center before:justify-center before:rounded-full before:border-[1.5px] before:border-landing-danger-text before:font-mono before:text-[10px] before:font-semibold before:content-['!'] motion-reduce:animate-none"
          id={`${id}-err`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

const ICON_PROPS = { fill: "none", viewBox: "0 0 20 20", className: "size-5" } as const;

export function MailIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        width="15"
        x="2.5"
        y="4.5"
      />
      <path
        d="M3.5 6 L10 11 L16.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect
        height="9"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        width="13"
        x="3.5"
        y="8.5"
      />
      <path
        d="M6.5 8.5 V6.5 a3.5 3.5 0 0 1 7 0 V8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.8 16.5 c.9-3 3.2-4.5 6.2-4.5 s5.3 1.5 6.2 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
