import { animate, createScope } from "animejs";
import { useEffect, useRef, type ReactNode } from "react";

import { GradientWaves } from "@/shared/ui/gradient-waves";
import GlyphPortal from "@/shared/ui/glyph-portal";

const fontFamily = '"Arial Black", Arial, sans-serif';

export function LandingGlyphPortal({ children }: { children: ReactNode }) {
  const portal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scope = createScope({ root: portal }).add(() => {
      animate("[data-landing-scroll-dot]", {
        translateY: [0, 14],
        opacity: [0.45, 1],
        duration: 900,
        ease: "inOut(2)",
        alternate: true,
        loop: true,
      });
      animate("[data-landing-scan-line]", {
        translateY: ["-10cqh", "110cqh"],
        opacity: [0, 0.8, 0],
        duration: 2_800,
        ease: "linear",
        loop: true,
      });
    });

    return () => scope.revert();
  }, []);

  return (
    <div
      ref={portal}
      className="h-[100svh] w-full overflow-y-auto"
      style={{ containerType: "inline-size", fontFamily }}
    >
      <style>{`
        .landing-glyph-portal [data-gp-caption],.landing-glyph-portal [data-sublime-header]{display:none;}
        .landing-glyph-portal [data-gp-content]{padding:0;}
      `}</style>
      <GlyphPortal
        className="landing-glyph-portal"
        word="OntaPulse"
        style={{
          "--gp-paper": "oklch(0.22 0.035 164)",
          "--gp-ink": "oklch(0.94 0.018 160)",
          "--gp-field": "oklch(0.3 0.065 164)",
          "--gp-foreground": "oklch(0.94 0.018 160)",
        }}
        fontFamily={fontFamily}
        fontWeight={700}
        scrollLength={2.3}
        interactive
        annotations={false}
        enterLabel="Sign in"
        contentId="landing-content"
        background={
          <div className="absolute inset-0 overflow-hidden bg-surface-raised">
            <GradientWaves
              className="absolute inset-0 size-full"
              horizonColor="#143c34"
              waveColor="#4dd5a2"
              crestColor="#d8f5e5"
              speed={0.4}
              amplitude={2.5}
              waveScale={0.6}
              waveRatio={0.9}
              swell={35}
              turbulence={20}
              tilt={1.11}
              zoom={1}
              height={5.5}
              fogDepth={15}
              detail="medium"
              brightness={1}
              opacity={1}
              mouseInteraction
              parallaxStrength={0.5}
              grain
              grainIntensity={0.05}
            />
          </div>
        }
        front={
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300/80 motion-reduce:hidden"
          >
            <div className="signal-grid absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,black,transparent)]" />
            <div className="absolute -top-32 left-[8%] size-80 rounded-full bg-signal/[0.07] blur-3xl" />
            <div className="absolute right-[7%] bottom-[12%] size-64 rounded-full bg-cyan-300/[0.05] blur-3xl" />
            <span className="absolute left-6 top-6 hidden items-center gap-2 sm:flex">
              <span className="size-1.5 rounded-full bg-signal shadow-[0_0_10px_rgba(53,211,158,.7)]" />{" "}
              System online
            </span>
            <span className="absolute right-6 top-6 hidden sm:block">Endpoint observability</span>
            <p className="absolute inset-x-0 top-[68%] text-center text-xs font-medium normal-case tracking-[0.12em] text-slate-300/70">
              Observe. Understand. Respond.
            </p>
            <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
              <span>Scroll to explore</span>
              <span className="flex h-9 w-5 justify-center rounded-full border border-slate-300/50 p-1">
                <span
                  data-landing-scroll-dot
                  className="size-1.5 rounded-full bg-signal shadow-[0_0_10px_rgba(53,211,158,.6)]"
                />
              </span>
            </div>
          </div>
        }
      >
        {children}
      </GlyphPortal>
    </div>
  );
}
