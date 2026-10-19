import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "cn";

/** Labelled on/off switch (Radix). Pair it with a visible label through `aria-label` or `id`. */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-7 w-12 flex-none cursor-pointer items-center rounded-full border border-landing-border-strong bg-landing-surface-2 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-landing-accent focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-landing-accent data-[state=checked]:bg-landing-accent/25 motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-landing-text-2 transition-transform duration-200 data-[state=checked]:translate-x-6 data-[state=checked]:bg-landing-accent motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
