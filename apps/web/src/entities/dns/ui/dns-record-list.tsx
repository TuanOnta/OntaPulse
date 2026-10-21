import { recordTypeName, visibleValues, type RecordRow } from "../model/dns-labels";

/**
 * Records of one name as a definition list: the type, then its values as text. Long lists show the first values
 * and "and N more"; a type without records says so instead of leaving a blank.
 */
export function DnsRecordList({ label, rows }: { label: string; rows: readonly RecordRow[] }) {
  return (
    <dl aria-label={label} className="m-0 flex flex-col gap-3.5">
      {rows.map((row) => {
        const { shown, hidden } = visibleValues(row.values);

        return (
          <div
            className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-1 max-[520px]:grid-cols-1"
            key={row.type}
          >
            <dt className="font-mono text-[12px] leading-[normal] tracking-[.08em] text-landing-muted uppercase">
              <span className="text-landing-text-2">{row.type}</span>
              <span className="hidden font-body tracking-normal normal-case min-[521px]:block">
                {recordTypeName(row.type)}
              </span>
            </dt>
            <dd className="m-0 min-w-0">
              {shown.length === 0 ? (
                <span className="text-[14px] text-landing-muted">None observed</span>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {shown.map((value) => (
                    <li
                      className="font-mono text-[14px] leading-[1.45] break-all text-landing-text-2"
                      key={value}
                    >
                      {value}
                    </li>
                  ))}
                  {hidden > 0 ? (
                    <li className="text-[14px] text-landing-muted">and {hidden} more</li>
                  ) : null}
                </ul>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
