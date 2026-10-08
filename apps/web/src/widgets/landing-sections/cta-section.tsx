import { CTA } from "./landing-copy";
import { AUTH_ROUTES, Container, LinkButton } from "./landing-ui";

export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="pt-32 pb-[300px]" id="cta">
      <Container className="flex flex-col items-center gap-7 text-center">
        <h2
          className="max-w-[780px] font-display text-[clamp(36px,5vw,64px)] leading-[1.05] font-bold tracking-[-.03em]"
          id="cta-title"
        >
          {CTA.title}
        </h2>
        <p className="max-w-[520px] text-landing-text-2">{CTA.lead}</p>
        <div className="flex flex-wrap justify-center gap-3.5">
          <LinkButton to={AUTH_ROUTES.register} variant="primary">
            {CTA.primary}
          </LinkButton>
          <LinkButton to={AUTH_ROUTES.login} variant="ghost">
            {CTA.secondary}
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
