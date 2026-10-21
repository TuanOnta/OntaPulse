import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import {
  DNS_CHANGE_SCOPES,
  DNS_ORGANIZATION_RECORD_TYPES,
  DNS_RECORD_TYPES,
  MAX_DNS_CHANGE_HISTORY,
  MAX_DNS_CHANGE_VALUES,
  MAX_DNS_CHANGE_VALUE_LENGTH,
  MAX_DNS_CHANGES_PER_ENTRY,
  MAX_DNS_NAME_LENGTH,
  MAX_DNS_SNAPSHOT_BYTES,
  MAX_DNS_VALUES_PER_TYPE,
  MAX_DNS_VALUE_LENGTH,
  type DnsRecordChange,
  type DnsSnapshot,
} from "./domain-watch.constants.js";
import { DomainWatchRepository } from "./domain-watch.repository.js";

export class DomainWatchService {
  constructor(
    private readonly repository: DomainWatchRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async findBaseline(monitorId: string, userId: string) {
    const monitor = await this.repository.findMonitorById(monitorId);

    if (!monitor) {
      throw monitorNotFound();
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      monitorNotFound(),
    );

    const baseline = await this.repository.findBaselineByMonitorId(monitorId);

    if (!baseline) {
      throw new AppError("No DNS baseline found", 404, "NO_DNS_BASELINE");
    }

    const changes = await this.repository.findRecentChanges(monitorId);

    return {
      ...baseline,
      snapshot: sanitizeSnapshot(baseline.snapshot),
      changes: changes
        .slice(0, MAX_DNS_CHANGE_HISTORY)
        .map((entry) => ({ ...entry, changes: sanitizeChanges(entry.changes) })),
    };
  }
}

function monitorNotFound(): AppError {
  return new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_DNS_NAME_LENGTH) : "";
}

/**
 * Re-applies the stored-shape rules. The worker is the only writer, but the API never passes through unknown
 * fields, non-text values, or an oversized snapshot.
 */
export function sanitizeSnapshot(value: unknown): DnsSnapshot {
  const record = asRecord(value);
  const host = asRecord(record.host);
  const organization = asRecord(record.organization);
  const list = (source: Record<string, unknown>, type: string) =>
    strings(source[type], MAX_DNS_VALUES_PER_TYPE, MAX_DNS_VALUE_LENGTH);

  const snapshot: DnsSnapshot = {
    host: {
      name: text(host.name),
      A: list(host, "A"),
      AAAA: list(host, "AAAA"),
      CNAME: list(host, "CNAME"),
      NS: list(host, "NS"),
      MX: list(host, "MX"),
      TXT: list(host, "TXT"),
    },
    organization: {
      name: text(organization.name),
      NS: list(organization, "NS"),
      MX: list(organization, "MX"),
    },
  };

  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_DNS_SNAPSHOT_BYTES) {
    // Keep the names and drop the long lists rather than pass an oversized document through.
    return {
      host: { name: snapshot.host.name, A: [], AAAA: [], CNAME: [], NS: [], MX: [], TXT: [] },
      organization: { name: snapshot.organization.name, NS: [], MX: [] },
    };
  }

  return snapshot;
}

export function sanitizeChanges(value: unknown): DnsRecordChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const changes: DnsRecordChange[] = [];

  for (const item of value) {
    if (changes.length >= MAX_DNS_CHANGES_PER_ENTRY) {
      break;
    }

    const { scope, type, added, removed } = asRecord(item);
    const knownScope = (DNS_CHANGE_SCOPES as readonly string[]).includes(String(scope));
    const allowedTypes: readonly string[] =
      scope === "organization" ? DNS_ORGANIZATION_RECORD_TYPES : DNS_RECORD_TYPES;

    if (!knownScope || !allowedTypes.includes(String(type))) {
      continue;
    }

    changes.push({
      scope: scope as DnsRecordChange["scope"],
      type: type as DnsRecordChange["type"],
      added: strings(added, MAX_DNS_CHANGE_VALUES, MAX_DNS_CHANGE_VALUE_LENGTH),
      removed: strings(removed, MAX_DNS_CHANGE_VALUES, MAX_DNS_CHANGE_VALUE_LENGTH),
    });
  }

  return changes;
}
