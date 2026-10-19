import type { Finding } from "@/shared/types/domain";
import { cn } from "cn";

import { categoryLabel, confidenceLabel, evidenceEntries } from "../model/finding-labels";
import { SEVERITY_TONE, SeverityPill } from "./severity-pill";

const CHIP =
  "inline-block rounded-[7px] border border-landing-border bg-landing-bg px-[9px] py-[3px] font-mono text-[13px] leading-[normal] text-landing-muted";

/**
 * One finding of a security check. Text comes from the API and is rendered as text only; evidence is a
 * bounded list of key/value rows. Wording is passive ("observed"), so no verdict is added here.
 */
export function FindingCard({ finding, index = 0 }: { finding: Finding; index?: number }) {
  const category = categoryLabel(finding.category);
  const confidence = confidenceLabel(finding.confidence);
  const evidence = evidenceEntries(finding.evidence);

  return (
    <li
      className={cn(
        "relative grid animate-dash-rise grid-cols-[auto_minmax(0,1fr)] gap-[18px] overflow-hidden rounded-[20px] border border-landing-border bg-landing-surface/[.78] py-5 pr-[22px] pl-[26px] [animation-fill-mode:backwards] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[rgb(var(--s))] before:shadow-[0_0_20px_rgba(var(--s),0.6)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(60%_140%_at_0%_50%,rgba(var(--s),0.08),transparent_70%)] after:content-[''] max-[640px]:grid-cols-1 max-[640px]:gap-2.5 motion-reduce:animate-none",
        SEVERITY_TONE[finding.severity],
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <SeverityPill severity={finding.severity}>{finding.severity}</SeverityPill>
      <div className="relative z-[1] min-w-0">
        <h3 className="font-display text-[20px] font-bold tracking-[-.01em] [overflow-wrap:anywhere]">
          {finding.title}
        </h3>
        <p className="mt-1.5 max-w-[70ch] text-[16px] text-landing-text-2">{finding.description}</p>
        {finding.recommendation ? (
          <p className="mt-2 max-w-[70ch] text-[15px] text-landing-muted">
            <span className="font-semibold text-landing-text-2">Suggested: </span>
            {finding.recommendation}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <code className={CHIP}>{finding.checkId ?? finding.code}</code>
          {category ? <span className="text-[14px] text-landing-muted">{category}</span> : null}
          {confidence ? (
            <span className="text-[14px] text-landing-muted">· {confidence}</span>
          ) : null}
        </div>
        {evidence.length > 0 ? (
          <details className="mt-3 text-[14px] text-landing-muted">
            <summary className="cursor-pointer text-landing-text-2">What was observed</summary>
            <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1">
              {evidence.map((entry) => (
                <div className="contents" key={entry.key}>
                  <dt className="font-mono text-[13px]">{entry.key}</dt>
                  <dd className="m-0 font-mono text-[13px] text-landing-text-2 [overflow-wrap:anywhere]">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  );
}
