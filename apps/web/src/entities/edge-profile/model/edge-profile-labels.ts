import type { EdgeDetection, EdgeSignal } from "@/shared/types/domain";

// Vendor keys follow docs/security-checks.md section 10. An unknown key from a newer API is shown as text.
const VENDOR_LABELS: Record<string, string> = {
  CLOUDFLARE: "Cloudflare",
  AWS_CLOUDFRONT: "Amazon CloudFront",
  AWS_WAF: "AWS WAF",
  VERCEL: "Vercel",
  FASTLY: "Fastly",
  DATADOME: "DataDome",
  HUMAN_PERIMETERX: "HUMAN",
};

const LAYER_LABELS: Record<string, string> = {
  CDN: "CDN",
  WAF: "WAF",
  ANTI_BOT: "Anti-bot",
};

const LAYER_ORDER = ["CDN", "WAF", "ANTI_BOT"];

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  HEADER_NAME: "Header",
  COOKIE_NAME: "Cookie",
  CERT_ISSUER: "Certificate issuer",
  CNAME_SUFFIX: "CNAME",
  NS_SUFFIX: "Name server",
  STATUS_MARKER: "Challenge marker",
};

/** "SOME_KEY" -> "some key": readable text for a value this client does not know yet. */
function readable(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export function vendorLabel(vendor: string): string {
  return VENDOR_LABELS[vendor] ?? readable(vendor);
}

export function layerLabel(layer: string): string {
  return LAYER_LABELS[layer] ?? readable(layer);
}

export function confidenceText(confidence: string): string {
  return CONFIDENCE_LABELS[confidence] ?? `${readable(confidence)} confidence`;
}

/** "Header: cf-ray". The name is text from the API and is only ever rendered as text. */
export function signalText(signal: EdgeSignal): string {
  return `${SIGNAL_TYPE_LABELS[signal.type] ?? readable(signal.type)}: ${signal.name}`;
}

/** Layers in a fixed order (CDN, WAF, anti-bot), then by vendor name, so a rescan does not reshuffle the list. */
export function sortDetections(detections: readonly EdgeDetection[]): EdgeDetection[] {
  const rank = (layer: string) => {
    const index = LAYER_ORDER.indexOf(layer);
    return index === -1 ? LAYER_ORDER.length : index;
  };

  return [...detections].sort(
    (a, b) =>
      rank(a.layer) - rank(b.layer) || vendorLabel(a.vendor).localeCompare(vendorLabel(b.vendor)),
  );
}

/** "Cloudflare, Amazon CloudFront, and DataDome": the vendors this client can name. */
export function supportedVendorsText(): string {
  const names = Object.values(VENDOR_LABELS);

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
