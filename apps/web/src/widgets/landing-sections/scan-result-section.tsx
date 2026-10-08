import { cn } from "cn";

import { RESULT } from "./landing-copy";
import { Container, Dot, Eyebrow, Lead, SectionTitle } from "./landing-ui";

const FINDING_STYLES = {
  HIGH: {
    card: "border-landing-finding-high-border",
    chip: "border-landing-failed-border text-landing-failed-text",
  },
  MEDIUM: {
    card: "border-landing-finding-medium-border",
    chip: "border-landing-sev-medium-border text-landing-sev-medium-text",
  },
} as const;

export function ScanResultSection() {
  const { sample } = RESULT;
  return (
    <section aria-labelledby="result-title" className="py-[120px]" id="result">
      <Container className="flex flex-wrap items-center gap-14">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <Eyebrow>{RESULT.eyebrow}</Eyebrow>
          <SectionTitle id="result-title">{RESULT.title}</SectionTitle>
          {RESULT.leads.map((text) => (
            <Lead key={text}>{text}</Lead>
          ))}
        </div>

        {/* Sample scan: static marketing content, not API data. */}
        <div
          aria-label="Sample scan result"
          className="flex min-w-0 flex-[1_1_460px] flex-col gap-6 rounded-3xl border border-landing-border bg-landing-surface p-7"
          role="group"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[14px] [overflow-wrap:anywhere]">{sample.url}</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-landing-status-border px-3 py-[5px] font-mono text-[12px] text-landing-status-text">
              <Dot />
              {sample.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {sample.stats.map((stat) => (
              <div
                className="flex flex-[1_1_140px] flex-col gap-1 rounded-[14px] bg-landing-bg-2 p-4"
                key={stat.label}
              >
                <small className="text-[13px] text-landing-muted">{stat.label}</small>
                <b className="font-mono text-[24px] font-medium">{stat.value}</b>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <small className="text-[13px] text-landing-muted">{sample.findingsLabel}</small>
            {sample.findings.map((finding) => {
              const style = FINDING_STYLES[finding.severity];
              return (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border px-4 py-3.5",
                    style.card,
                  )}
                  key={finding.type}
                >
                  <div>
                    <span className="font-mono text-[14px]">{finding.type}</span>
                    <small className="block text-[14px] text-landing-muted">{finding.text}</small>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[12px]",
                      style.chip,
                    )}
                  >
                    {finding.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
