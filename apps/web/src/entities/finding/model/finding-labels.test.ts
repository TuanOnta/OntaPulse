import { describe, expect, it } from "vitest";

import { categoryLabel, confidenceLabel, evidenceEntries } from "./finding-labels";

describe("finding labels", () => {
  it("names every known category and shows an unknown one as it is", () => {
    expect(categoryLabel("HEADERS")).toBe("Security headers");
    expect(categoryLabel("TLS")).toBe("TLS and certificate");
    expect(categoryLabel("EMAIL_AUTH")).toBe("Email authentication");
    expect(categoryLabel("FUTURE_CATEGORY")).toBe("FUTURE_CATEGORY");
  });

  it("has no category or confidence line when the API sent none", () => {
    expect(categoryLabel(null)).toBeNull();
    expect(categoryLabel(undefined)).toBeNull();
    expect(confidenceLabel(null)).toBeNull();
    expect(confidenceLabel(undefined)).toBeNull();
  });

  it("words the confidence", () => {
    expect(confidenceLabel("LOW")).toBe("Confidence: low");
    expect(confidenceLabel("MEDIUM")).toBe("Confidence: medium");
    expect(confidenceLabel("HIGH")).toBe("Confidence: high");
    expect(confidenceLabel("EXTREME")).toBe("Confidence: EXTREME");
  });
});

describe("evidenceEntries", () => {
  it("turns evidence into text rows", () => {
    expect(
      evidenceEntries({ header: "content-security-policy", count: 3, ok: false, list: ["a", "b"] }),
    ).toEqual([
      { key: "header", value: "content-security-policy" },
      { key: "count", value: "3" },
      { key: "ok", value: "false" },
      { key: "list", value: '["a","b"]' },
    ]);
  });

  it("keeps markup as plain text, never interprets it", () => {
    const [entry] = evidenceEntries({ policy: "<img src=x onerror=alert(1)>" });

    expect(entry?.value).toBe("<img src=x onerror=alert(1)>");
  });

  it("is bounded in rows and in value length", () => {
    const evidence = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`k${index}`, "x".repeat(500)]),
    );

    const entries = evidenceEntries(evidence);

    expect(entries).toHaveLength(8);
    expect(entries.every((entry) => entry.value.length === 200)).toBe(true);
  });

  it.each([null, undefined, "text", 5, ["a"]])("returns no rows for %j", (value) => {
    expect(evidenceEntries(value)).toEqual([]);
  });
});
