import { cn } from "cn";

export function SignalField({
  className,
  density = "default",
}: {
  className?: string;
  density?: "default" | "fine";
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div className="signal-field-glow absolute inset-0" />
      <div
        className={cn(
          "signal-grid absolute inset-0 opacity-[0.16] [mask-image:radial-gradient(ellipse_75%_62%_at_50%_38%,black,transparent)]",
          density === "fine" && "signal-grid-fine opacity-[0.11]",
        )}
      />
      <div className="signal-scan-line absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent motion-reduce:hidden" />
      <div className="absolute top-[18%] left-[12%] size-1 rounded-full bg-signal shadow-[0_0_18px_4px_oklch(0.78_0.15_160/.45)]" />
      <div className="absolute top-[34%] right-[18%] size-1 rounded-full bg-info shadow-[0_0_18px_4px_oklch(0.78_0.1_196/.35)]" />
      <div className="absolute bottom-[21%] left-[46%] size-1 rounded-full bg-highlight shadow-[0_0_18px_4px_oklch(0.76_0.11_205/.3)]" />
    </div>
  );
}

export function BorderBeam({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "signal-border-beam pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal to-transparent motion-reduce:hidden",
        className,
      )}
    />
  );
}
