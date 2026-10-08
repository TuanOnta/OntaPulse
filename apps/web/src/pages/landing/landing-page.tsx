import { cn } from "cn";
import { Suspense } from "react";

import { LandingScene, useLandingScroll, useLifecycleKey } from "@/widgets/landing-scene";
import {
  CtaSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  LandingHeader,
  PAGE_INSET,
  ScanResultSection,
} from "@/widgets/landing-sections";

/** Landing page: five sections (hero, how, result, features, cta) over the decorative 3D orb. */
export function LandingPage() {
  useLandingScroll();
  const activeKey = useLifecycleKey();

  return (
    <div className="min-h-screen overflow-x-clip bg-landing-bg font-landing-body text-[17px] leading-[1.55] text-landing-text [&_a:focus-visible]:outline-landing-text [&_a:focus-visible]:outline-offset-[3px]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-landing-accent focus:px-4 focus:py-2 focus:text-landing-accent-ink"
        href="#top"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <LandingScene />
      </Suspense>
      <LandingHeader />
      <main className={cn("relative z-[1]", PAGE_INSET)} id="top">
        <HeroSection />
        <HowItWorksSection activeKey={activeKey} />
        <ScanResultSection />
        <FeaturesSection />
        <CtaSection />
      </main>
    </div>
  );
}
