export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "NS", "MX", "TXT"] as const;
export const DNS_ORGANIZATION_RECORD_TYPES = ["NS", "MX"] as const;
export const DNS_CHANGE_SCOPES = ["host", "organization"] as const;

// The worker bounds what it stores (16 KB snapshot, 50 changes per monitor); the API re-applies the bounds.
export const MAX_DNS_VALUES_PER_TYPE = 100;
export const MAX_DNS_VALUE_LENGTH = 512;
export const MAX_DNS_NAME_LENGTH = 255;
export const MAX_DNS_CHANGE_VALUES = 20;
export const MAX_DNS_CHANGE_VALUE_LENGTH = 255;
export const MAX_DNS_CHANGES_PER_ENTRY = 12;
export const MAX_DNS_CHANGE_HISTORY = 50;
export const MAX_DNS_SNAPSHOT_BYTES = 16_384;

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
export type DnsChangeScope = (typeof DNS_CHANGE_SCOPES)[number];

export interface DnsHostSnapshot {
  name: string;
  A: string[];
  AAAA: string[];
  CNAME: string[];
  NS: string[];
  MX: string[];
  TXT: string[];
}

export interface DnsOrganizationSnapshot {
  name: string;
  NS: string[];
  MX: string[];
}

export interface DnsSnapshot {
  host: DnsHostSnapshot;
  organization: DnsOrganizationSnapshot;
}

export interface DnsRecordChange {
  scope: DnsChangeScope;
  type: DnsRecordType;
  added: string[];
  removed: string[];
}
