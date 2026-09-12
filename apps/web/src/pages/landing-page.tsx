import { ArrowRight, CheckCircle2, Radar } from "lucide-react";
import { animate, createScope } from "animejs";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/ui/button";
import { LandingGlyphPortal } from "@/widgets/landing/landing-glyph-portal";

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scope = createScope({ root }).add(() => {
      animate("[data-orbit]", {
        rotate: 360,
        duration: 24_000,
        ease: "linear",
        loop: true,
      });
      animate("[data-signal]", {
        opacity: [0.35, 1],
        scale: [0.94, 1.08],
        duration: 1_800,
        ease: "inOut(2)",
        direction: "alternate",
        loop: true,
      });
    });
    return () => scope.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen overflow-x-hidden bg-canvas text-ink">
      <main>
        <LandingGlyphPortal>
          <section className="relative mx-auto grid min-h-[calc(100svh-80px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
            <div className="relative z-10">
              <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-signal">
                OPERATIONAL CLARITY
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-balance sm:text-7xl lg:text-8xl">
                Know when your service needs you.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
                OntaPulse continuously checks your most important endpoints, keeps each result in
                context, and turns failures into clear next steps.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/register">
                    Create an account <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Open dashboard</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-signal" /> HTTP checks
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-signal" /> Scan findings
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-signal" /> Team workspaces
                </span>
              </div>
            </div>
            <div
              className="relative mx-auto grid aspect-square w-full max-w-xl place-items-center"
              aria-hidden="true"
            >
              <div
                data-orbit
                className="absolute inset-[5%] rounded-full border border-signal/25"
              />
              <div className="absolute inset-[18%] rounded-full border border-slate-600/50" />
              <div className="absolute inset-[33%] rounded-full border border-signal/30" />
              <div
                data-signal
                className="grid size-36 place-items-center rounded-full border border-signal/40 bg-signal/10 shadow-[0_0_100px_rgba(53,211,158,.18)]"
              >
                <Radar className="size-14 text-signal" />
              </div>
              <div className="absolute right-[2%] top-[18%] rounded-lg border border-slate-700/70 bg-surface px-4 py-3 shadow-xl">
                <p className="text-xs text-muted">api.ontapulse.app</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <span className="size-2 rounded-full bg-signal" /> Healthy · 184 ms
                </p>
              </div>
              <div className="absolute bottom-[13%] left-[1%] rounded-lg border border-slate-700/70 bg-surface px-4 py-3 shadow-xl">
                <p className="text-xs text-muted">Latest scan</p>
                <p className="mt-1 text-sm font-medium">HTTP 200 · no findings</p>
              </div>
            </div>
          </section>
        </LandingGlyphPortal>
      </main>
    </div>
  );
}
