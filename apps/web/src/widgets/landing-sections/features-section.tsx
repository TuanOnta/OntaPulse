import { FEATURES } from "./landing-copy";
import { Container, Eyebrow, SectionTitle } from "./landing-ui";

export function FeaturesSection() {
  return (
    <section aria-labelledby="features-title" className="py-28" id="features">
      <Container>
        <div className="flex max-w-[720px] flex-col gap-4">
          <Eyebrow>{FEATURES.eyebrow}</Eyebrow>
          <SectionTitle id="features-title">{FEATURES.title}</SectionTitle>
        </div>
        <ul className="mt-12 flex list-none flex-wrap gap-5 p-0">
          {FEATURES.items.map((item) => (
            <li
              className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 rounded-[20px] border border-landing-border bg-landing-surface p-7"
              key={item.title}
            >
              <h3 className="font-display text-[22px] font-bold">{item.title}</h3>
              <p className="text-landing-text-2">{item.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="font-mono text-[12px] tracking-[.08em] text-landing-muted uppercase">
            {FEATURES.comingSoonLabel}
          </span>
          {FEATURES.comingSoon.map((tag) => (
            <span
              className="rounded-full border border-dashed border-landing-border-strong bg-landing-bg/[.85] px-3.5 py-1.5 text-[15px] text-landing-text-2"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
