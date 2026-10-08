import { cn } from "cn";

import { HOW, type StepKey } from "./landing-copy";
import { Container, Eyebrow, Lead, SectionTitle } from "./landing-ui";

type ActiveKey = StepKey | "";

const PILL_BASE =
  "rounded-full border border-landing-border-strong bg-landing-bg/70 px-3.5 py-1.5 text-landing-text-2 transition-[background-color,color] duration-300 motion-reduce:transition-none data-[active=true]:text-landing-accent-ink";

/** `activeKey` comes from the scroll-synced lifecycle store, owned by the page. */
export function HowItWorksSection({ activeKey }: { activeKey: ActiveKey }) {
  return (
    <section aria-labelledby="how-title" className="min-h-[140vh] py-[120px]" id="how">
      <Container>
        <div className="flex max-w-[480px] flex-col gap-4">
          <Eyebrow>{HOW.eyebrow}</Eyebrow>
          <SectionTitle id="how-title">{HOW.title}</SectionTitle>
          <Lead>{HOW.lead}</Lead>

          {HOW.steps.map((step) => {
            const active = activeKey === step.key;
            return (
              <div
                aria-current={active ? "step" : undefined}
                className="mt-5 flex flex-col gap-2.5 rounded-[18px] border border-landing-border bg-landing-surface/[.92] p-6 transition-[border-color,transform] duration-300 data-[active=true]:translate-x-1.5 data-[active=true]:border-landing-accent motion-reduce:transition-none motion-reduce:data-[active=true]:translate-x-0"
                data-active={active}
                data-step={step.key}
                key={step.key}
              >
                <span className="font-mono text-[14px] text-landing-accent">{step.num}</span>
                <h3 className="font-display text-[26px] font-bold">{step.title}</h3>
                <p className="text-landing-text-2">{step.body}</p>
              </div>
            );
          })}

          <div
            aria-label="Scan status lifecycle"
            className="mt-7 flex flex-wrap items-center gap-2.5 font-mono text-[13px]"
            role="group"
          >
            <span
              className={cn(PILL_BASE, "data-[active=true]:bg-landing-text-2")}
              data-active={activeKey === "queued"}
              data-pill="queued"
            >
              QUEUED
            </span>
            <span aria-hidden="true" className="text-landing-muted">
              →
            </span>
            <span
              className={cn(
                PILL_BASE,
                "data-[active=true]:border-landing-info data-[active=true]:bg-landing-info",
              )}
              data-active={activeKey === "running"}
              data-pill="running"
            >
              RUNNING
            </span>
            <span aria-hidden="true" className="text-landing-muted">
              →
            </span>
            <span
              className={cn(
                PILL_BASE,
                "data-[active=true]:border-landing-accent data-[active=true]:bg-landing-accent",
              )}
              data-active={activeKey === "done"}
              data-pill="done"
            >
              SUCCEEDED
            </span>
            <span className="text-landing-muted">or</span>
            <span className="rounded-full border border-landing-failed-border bg-landing-bg/70 px-3.5 py-1.5 text-landing-failed-text">
              FAILED
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
