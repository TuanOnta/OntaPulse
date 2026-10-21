import { describe, expect, it } from "vitest";

import type { DnsChangeEntry, DnsSnapshot } from "@/shared/types/domain";

import {
  MAX_VISIBLE_CHANGES,
  MAX_VISIBLE_VALUES,
  changeSummary,
  changeTitle,
  hostRows,
  organizationRows,
  recentChanges,
  recordTypeName,
  scopeName,
  visibleValues,
} from "./dns-labels";

const snapshot: DnsSnapshot = {
  host: {
    name: "www.example.com",
    A: ["93.184.216.34"],
    AAAA: [],
    CNAME: [],
    NS: [],
    MX: [],
    TXT: ["v=spf1 -all"],
  },
  organization: { name: "example.com", NS: ["a.iana-servers.net"], MX: ["0 ."] },
};

const entry = (id: string, observedAt: string): DnsChangeEntry => ({
  scanId: id,
  observedAt,
  changes: [{ scope: "host", type: "A", added: ["1.1.1.1"], removed: [] }],
});

describe("dns labels", () => {
  it.each([
    ["A", "IPv4 addresses"],
    ["AAAA", "IPv6 addresses"],
    ["CNAME", "Alias"],
    ["NS", "Name servers"],
    ["MX", "Mail servers"],
    ["TXT", "Text records"],
    ["SRV", "SRV"],
  ])("names the record type %s as %s", (type, name) => {
    expect(recordTypeName(type)).toBe(name);
  });

  it("lists the host records in a fixed order with an empty list for a missing type", () => {
    expect(hostRows(snapshot).map((row) => row.type)).toEqual([
      "A",
      "AAAA",
      "CNAME",
      "NS",
      "MX",
      "TXT",
    ]);
    expect(hostRows(snapshot)[1]).toEqual({ type: "AAAA", values: [] });
    expect(hostRows(snapshot)[5]).toEqual({ type: "TXT", values: ["v=spf1 -all"] });
  });

  it("lists the organizational records as name servers then mail servers", () => {
    expect(organizationRows(snapshot)).toEqual([
      { type: "NS", values: ["a.iana-servers.net"] },
      { type: "MX", values: ["0 ."] },
    ]);
  });

  it("copes with a damaged snapshot without throwing", () => {
    const damaged = {
      host: { name: "x", A: "oops", AAAA: [1, "2001:db8::1"] },
      organization: {},
    } as unknown as DnsSnapshot;

    expect(hostRows(damaged)[0]).toEqual({ type: "A", values: [] });
    expect(hostRows(damaged)[1]).toEqual({ type: "AAAA", values: ["2001:db8::1"] });
    expect(organizationRows(damaged)).toEqual([
      { type: "NS", values: [] },
      { type: "MX", values: [] },
    ]);
  });

  it("shows the first values and counts the rest", () => {
    const values = Array.from({ length: MAX_VISIBLE_VALUES + 3 }, (_, index) => `v${index}`);

    expect(visibleValues(values)).toEqual({
      shown: values.slice(0, MAX_VISIBLE_VALUES),
      hidden: 3,
    });
    expect(visibleValues(["a", "b"])).toEqual({ shown: ["a", "b"], hidden: 0 });
    expect(visibleValues([], 2)).toEqual({ shown: [], hidden: 0 });
    expect(visibleValues(["a", "b", "c"], 2)).toEqual({ shown: ["a", "b"], hidden: 1 });
  });

  it("says where a change happened", () => {
    expect(scopeName("host")).toBe("host");
    expect(scopeName("organization")).toBe("organizational domain");
    expect(changeTitle({ scope: "organization", type: "NS" })).toBe(
      "NS of the organizational domain",
    );
    expect(changeTitle({ scope: "host", type: "A" })).toBe("A of the host");
  });

  it.each([
    [{ added: ["x"], removed: [] }, "1 added"],
    [{ added: [], removed: ["x", "y"] }, "2 removed"],
    [{ added: ["x"], removed: ["y"] }, "1 added, 1 removed"],
    [{ added: [], removed: [] }, "no values"],
  ])("summarizes %j as %s", (change, text) => {
    expect(changeSummary(change)).toBe(text);
  });

  it("orders changes newest first, limits them, and counts the older ones", () => {
    const entries = Array.from({ length: MAX_VISIBLE_CHANGES + 4 }, (_, index) =>
      entry(`s${index}`, new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString()),
    );

    const { shown, hidden } = recentChanges(entries);

    expect(shown).toHaveLength(MAX_VISIBLE_CHANGES);
    expect(hidden).toBe(4);
    expect(shown[0]?.scanId).toBe(`s${MAX_VISIBLE_CHANGES + 3}`);
  });

  it("does not change the order of the input", () => {
    const entries = [entry("old", "2026-10-01T00:00:00Z"), entry("new", "2026-10-02T00:00:00Z")];

    recentChanges(entries);

    expect(entries.map((item) => item.scanId)).toEqual(["old", "new"]);
  });
});
