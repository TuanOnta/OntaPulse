import { Link } from "react-router-dom";

import { formatFull } from "@/shared/lib/format";
import type { DnsChangeEntry as Entry } from "@/shared/types/domain";

import { changeSummary, changeTitle, visibleValues } from "../model/dns-labels";

function ValueLines({ values, sign }: { values: readonly string[]; sign: "added" | "removed" }) {
  const { shown, hidden } = visibleValues(values);
  const mark = sign === "added" ? "+" : "−";
  const word = sign === "added" ? "Added" : "Removed";

  return (
    <ul aria-label={word} className="m-0 flex list-none flex-col gap-1 p-0">
      {shown.map((value) => (
        <li
          className={
            sign === "added"
              ? "flex gap-2 font-mono text-[14px] leading-[1.45] text-landing-accent"
              : "flex gap-2 font-mono text-[14px] leading-[1.45] text-landing-danger-text"
          }
          key={value}
        >
          <span aria-hidden="true">{mark}</span>
          <span className="sr-only">{word}: </span>
          <span className="min-w-0 break-all">{value}</span>
        </li>
      ))}
      {hidden > 0 ? (
        <li className="text-[14px] text-landing-muted">
          {word.toLowerCase()}: and {hidden} more
        </li>
      ) : null}
    </ul>
  );
}

/**
 * One scan that changed something: when, a link to that scan, and per changed record type the added and removed
 * values. Added and removed carry a sign and a word, so colour is never the only signal.
 */
export function DnsChangeEntry({
  entry,
  scanHref,
}: {
  entry: Entry;
  scanHref?: (id: string) => string;
}) {
  return (
    <li className="rounded-[18px] border border-landing-border bg-landing-bg/40 px-4 py-3.5">
      <p className="text-[14px] text-landing-muted">
        {formatFull(entry.observedAt)}
        {scanHref ? (
          <>
            {" "}
            ·{" "}
            <Link
              className="text-landing-accent underline underline-offset-4"
              to={scanHref(entry.scanId)}
            >
              Open the scan
            </Link>
          </>
        ) : null}
      </p>
      <ul aria-label="Changed records" className="m-0 mt-2.5 flex list-none flex-col gap-3 p-0">
        {entry.changes.map((change) => (
          <li key={`${change.scope}-${change.type}`}>
            <p className="text-[15px] font-medium text-landing-text">
              {changeTitle(change)}
              <span className="ml-2 text-[14px] font-normal text-landing-muted">
                {changeSummary(change)}
              </span>
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {change.added.length > 0 ? <ValueLines sign="added" values={change.added} /> : null}
              {change.removed.length > 0 ? (
                <ValueLines sign="removed" values={change.removed} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}
