import { Activity, CheckCircle2, Gauge, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { LandingAuthPanel, type AuthMode } from "@/features/auth/landing-auth-panel";
import { BlurFade } from "@/shared/ui/blur-fade";
import { SignalField } from "@/shared/ui/signal-field";
import { LandingGlyphPortal } from "@/widgets/landing/landing-glyph-portal";

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-ink">
      <main>
        <LandingGlyphPortal>
          <motion.section
            className="relative isolate min-h-[100svh] overflow-hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ amount: 0.22, once: true }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.38, ease: "easeOut" }}
          >
            <SignalField />
            <div className="signal-noise pointer-events-none absolute inset-0 opacity-[0.02]" />
            <div className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-14 px-5 py-16 [overflow-anchor:none] sm:px-8 lg:grid-cols-[1.06fr_.94fr] lg:py-20">
              <div className="relative z-10">
                <BlurFade>
                  <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-medium text-primary">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    Your operational signal, in focus
                  </div>
                </BlurFade>
                <BlurFade delay={0.08}>
                  <h1 className="max-w-3xl text-[clamp(3.3rem,6.6vw,6.5rem)] leading-[0.92] font-semibold tracking-[-0.065em] text-balance">
                    Catch the signal before it becomes noise.
                  </h1>
                </BlurFade>
                <BlurFade delay={0.16}>
                  <p className="mt-7 max-w-xl text-base leading-7 text-foreground/75 sm:text-lg sm:leading-8">
                    Endpoint health, response time, and actionable scan findings in one calm command
                    center for teams that ship continuously.
                  </p>
                </BlurFade>
                <BlurFade className="mt-10 grid max-w-xl grid-cols-3 gap-3" delay={0.22}>
                  {[
                    { icon: Gauge, value: "184 ms", label: "Response" },
                    { icon: ShieldCheck, value: "99.98%", label: "Uptime" },
                    { icon: Activity, value: "0", label: "Findings" },
                  ].map(({ icon: Icon, value, label }) => (
                    <div className="border-l border-border pl-3 sm:pl-4" key={label}>
                      <Icon className="size-4 text-primary" />
                      <p className="mt-2 text-sm font-semibold sm:text-base">{value}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </BlurFade>

                <BlurFade
                  className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
                  delay={0.28}
                >
                  {["HTTP checks", "Clear findings", "Team workspaces"].map((label) => (
                    <span className="flex items-center gap-2" key={label}>
                      <CheckCircle2 className="size-3.5 text-primary" /> {label}
                    </span>
                  ))}
                </BlurFade>
              </div>

              <BlurFade delay={0.18}>
                <LandingAuthPanel mode={authMode} onModeChange={setAuthMode} />
              </BlurFade>
            </div>
          </motion.section>
        </LandingGlyphPortal>
      </main>
    </div>
  );
}
