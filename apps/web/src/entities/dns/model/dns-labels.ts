import type { DnsChangeEntry, DnsRecordChange, DnsSnapshot } from "@/shared/types/domain";

/** Record types in the order a person reads them: addresses, alias, name servers, mail, text. */
export const HOST_RECORD_ORDER = ["A", "AAAA", "CNAME", "NS", "MX", "TXT"] as const;
export const ORGANIZATION_RECORD_ORDER = ["NS", "MX"] as const;

export const MAX_VISIBLE_VALUES = 6;
export const MAX_VISIBLE_CHANGES = 10;

const TYPE_NAMES: Record<string, string> = {
  A: "IPv4 addresses",
  AAAA: "IPv6 addresses",
  CNAME: "Alias",
  NS: "Name servers",
  MX: "Mail servers",
  TXT: "Text records",
};

/** "Name servers", or the type itself when a newer API sends a type this client does not know. */
export function recordTypeName(type: string): string {
  return TYPE_NAMES[type] ?? type;
}

export type RecordRow = { type: string; values: string[] };

function rows(source: Record<string, unknown>, order: readonly string[]): RecordRow[] {
  return order.map((type) => {
    const value = source[type];

    return {
      type,
      values: Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [],
    };
  });
}

/** Records of the host, one row per type in a fixed order; a type without records has an empty list. */
export function hostRows(snapshot: DnsSnapshot): RecordRow[] {
  return rows(snapshot.host as unknown as Record<string, unknown>, HOST_RECORD_ORDER);
}

/** Records of the organizational domain (name servers and mail servers). */
export function organizationRows(snapshot: DnsSnapshot): RecordRow[] {
  return rows(
    snapshot.organization as unknown as Record<string, unknown>,
    ORGANIZATION_RECORD_ORDER,
  );
}

/** The first `max` values and how many were left out, so a long TXT list never fills the screen. */
export function visibleValues(
  values: readonly string[],
  max: number = MAX_VISIBLE_VALUES,
): { shown: string[]; hidden: number } {
  return { shown: values.slice(0, max), hidden: Math.max(0, values.length - max) };
}

export function scopeName(scope: string): string {
  return scope === "organization" ? "organizational domain" : "host";
}

/** "NS of the organizational domain": which records changed and where. */
export function changeTitle(change: Pick<DnsRecordChange, "scope" | "type">): string {
  return `${change.type} of the ${scopeName(change.scope)}`;
}

/** "1 added, 2 removed", or "no values" for a change without any. */
export function changeSummary(change: Pick<DnsRecordChange, "added" | "removed">): string {
  const parts: string[] = [];
  if (change.added.length > 0) parts.push(`${change.added.length} added`);
  if (change.removed.length > 0) parts.push(`${change.removed.length} removed`);

  return parts.length > 0 ? parts.join(", ") : "no values";
}

/** The newest entries first, at most `max`, and how many older ones are left out. */
export function recentChanges(
  entries: readonly DnsChangeEntry[],
  max: number = MAX_VISIBLE_CHANGES,
): { shown: DnsChangeEntry[]; hidden: number } {
  const sorted = [...entries].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  return { shown: sorted.slice(0, max), hidden: Math.max(0, sorted.length - max) };
}
