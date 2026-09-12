import { animate, createScope } from "animejs";
import { useEffect, useRef, useState, type ReactNode } from "react";

import GlyphPortal from "@/shared/ui/glyph-portal";

const fontFamily = '"Glyph Portal Jakarta", Arial, sans-serif';
let fontLoad: Promise<void> | undefined;

export function LandingGlyphPortal({ children }: { children: ReactNode }) {
  const [face, setFace] = useState("Arial, sans-serif");
  const portal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fontLoad ??= new FontFace(
      "Glyph Portal Jakarta",
      'url("https://cdn.21st.dev/assets/mirror/15/153fc85b70298beeb1d61a5f723331649e7f23bb77302a66e61cb3e2fbdb5e79.woff2")',
      { weight: "400 700" },
    )
      .load()
      .then((font) => {
        document.fonts.add(font);
      });
    const loadedFont = fontLoad;
    void loadedFont.then(() => {
      if (active) setFace(fontFamily);
    });
    return () => {
      active = false;
    };
  }, []);

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
      style={{ containerType: "inline-size", fontFamily: face }}
    >
      <style>{`
        .landing-glyph-portal [data-gp-caption],.landing-glyph-portal [data-sublime-header]{display:none;}
        .landing-glyph-portal [data-gp-content]{padding:0;}
      `}</style>
      <GlyphPortal
        className="landing-glyph-portal"
        word="OntaPulse"
        fontFamily={face}
        fontWeight={700}
        scrollLength={2.3}
        interactive
        annotations={false}
        enterLabel="Sign in"
        contentId="landing-content"
        background={
          <div className="absolute inset-0 overflow-hidden bg-[#0b3b2a]">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(216,239,225,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(216,239,225,.18) 1px,transparent 1px)",
                backgroundSize: "38px 38px",
              }}
            />
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full text-[#d8efe1]/35"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <circle cx="76" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="0.35" />
              <circle cx="76" cy="30" r="15" fill="none" stroke="currentColor" strokeWidth="0.35" />
              <path
                d="M0 74C19 64 31 81 48 67s30-4 52-22"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
              />
              <path d="M0 75h100M76 0v100" stroke="currentColor" strokeWidth="0.25" />
            </svg>
            <span data-landing-scan-line className="absolute inset-x-0 top-0 h-px bg-[#d8efe1]" />
          </div>
        }
        front={
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0c1212]/80 motion-reduce:hidden"
          >
            <span className="absolute left-6 top-6 hidden items-center gap-2 sm:flex">
              <span className="size-1.5 rounded-full bg-[#0c1212]" /> System online
            </span>
            <span className="absolute right-6 top-6 hidden sm:block">Endpoint observability</span>
            <p className="absolute inset-x-0 top-[68%] text-center text-xs font-medium normal-case tracking-[0.12em] text-[#0c1212]/70">
              Observe. Understand. Respond.
            </p>
            <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2">
              <span>Scroll to explore</span>
              <span className="flex h-9 w-5 justify-center rounded-full border border-[#0c1212]/55 p-1">
                <span
                  data-landing-scroll-dot
                  className="size-1.5 rounded-full bg-[#0c1212] shadow-[0_0_10px_rgba(12,18,18,.45)]"
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
