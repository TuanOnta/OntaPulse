import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "cn";

/** Labelled checkbox (Radix). Pair it with a visible label through `id` and `htmlFor`. */
export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "grid size-6 flex-none cursor-pointer place-items-center rounded-[7px] border border-landing-border-strong bg-landing-bg/80 text-landing-accent-ink transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-landing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-landing-accent data-[state=checked]:bg-landing-accent motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 14 14" width="14">
          <path
            d="M2.5 7.4 L5.6 10.4 L11.5 3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
