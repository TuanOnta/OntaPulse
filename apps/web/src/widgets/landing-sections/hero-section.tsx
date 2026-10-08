import { HERO } from "./landing-copy";
import { AUTH_ROUTES, AnchorButton, Container, Dot, LinkButton } from "./landing-ui";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="flex min-h-[calc(100svh-74px)] items-center"
      id="hero"
    >
      <Container className="w-full pt-16 pb-24">
        <div className="flex max-w-[560px] flex-col items-start gap-[26px]">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-landing-border bg-landing-bg/60 px-3.5 py-1.5 font-mono text-[12px] tracking-[.08em] text-landing-muted uppercase">
            <Dot />
            {HERO.chip}
          </div>
          <h1
            className="font-display text-[clamp(44px,6.2vw,80px)] leading-[1.02] font-bold tracking-[-.03em]"
            id="hero-title"
          >
            {HERO.title}
          </h1>
          <p className="max-w-[520px] text-[19px] text-landing-text-2">{HERO.sub}</p>
          <div className="flex flex-wrap gap-3.5">
            <LinkButton to={AUTH_ROUTES.register} variant="primary">
              {HERO.primaryCta}
            </LinkButton>
            <AnchorButton href="#how" variant="ghost">
              {HERO.secondaryCta}
            </AnchorButton>
          </div>
          <p className="font-mono text-[13px] text-landing-muted">{HERO.meta}</p>
        </div>
      </Container>
    </section>
  );
}
