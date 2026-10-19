import type { FindingCategory, FindingConfidence } from "@/shared/types/domain";

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  HEADERS: "Security headers",
  COOKIES: "Cookies",
  CORS: "CORS",
  REDIRECT: "HTTP to HTTPS redirect",
  TLS: "TLS and certificate",
  EXPOSED_FILES: "Exposed files",
  DNS: "DNS",
  EMAIL_AUTH: "Email authentication",
};

const CONFIDENCE_LABELS: Record<FindingConfidence, string> = {
  LOW: "Confidence: low",
  MEDIUM: "Confidence: medium",
  HIGH: "Confidence: high",
};

/** Readable category. An unknown value from a newer API is shown as it is, never hidden. */
export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABELS[category as FindingCategory] ?? category;
}

/** Confidence line, or null when the API sent none (deterministic findings carry no confidence). */
export function confidenceLabel(confidence: string | null | undefined): string | null {
  if (!confidence) return null;
  return CONFIDENCE_LABELS[confidence as FindingConfidence] ?? `Confidence: ${confidence}`;
}

const MAX_EVIDENCE_ENTRIES = 8;
const MAX_EVIDENCE_VALUE_CHARS = 200;

/** Evidence as bounded text rows. Values are never interpreted as HTML or JSON for display. */
export function evidenceEntries(evidence: unknown): { key: string; value: string }[] {
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) return [];

  return Object.entries(evidence as Record<string, unknown>)
    .slice(0, MAX_EVIDENCE_ENTRIES)
    .map(([key, value]) => {
      const text =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value);

      return { key, value: (text ?? "").slice(0, MAX_EVIDENCE_VALUE_CHARS) };
    });
}
