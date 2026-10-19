export const EDGE_LAYERS = ["CDN", "WAF", "ANTI_BOT"] as const;
export const EDGE_CONFIDENCES = ["LOW", "MEDIUM", "HIGH"] as const;
export const EDGE_SIGNAL_TYPES = [
  "HEADER_NAME",
  "COOKIE_NAME",
  "CERT_ISSUER",
  "CNAME_SUFFIX",
  "NS_SUFFIX",
  "STATUS_MARKER",
] as const;

// Vendor keys the catalog (docs/security-checks.md section 10) can produce. Akamai and Imperva have
// no verified fingerprints yet and are therefore not listed.
export const EDGE_VENDORS = [
  "CLOUDFLARE",
  "AWS_CLOUDFRONT",
  "AWS_WAF",
  "VERCEL",
  "FASTLY",
  "DATADOME",
  "HUMAN_PERIMETERX",
] as const;

// The worker caps what it stores; the API re-applies the caps before answering.
export const MAX_EDGE_DETECTIONS = 16;
export const MAX_EDGE_SIGNALS_PER_DETECTION = 8;
export const MAX_EDGE_SIGNAL_NAME_LENGTH = 100;
export const MAX_EDGE_PROFILE_BYTES = 8192;

export type EdgeLayer = (typeof EDGE_LAYERS)[number];
export type EdgeConfidence = (typeof EDGE_CONFIDENCES)[number];
export type EdgeSignalType = (typeof EDGE_SIGNAL_TYPES)[number];
export type EdgeVendor = (typeof EDGE_VENDORS)[number];

export interface EdgeSignal {
  type: EdgeSignalType;
  name: string;
}

export interface EdgeDetection {
  vendor: EdgeVendor;
  layer: EdgeLayer;
  confidence: EdgeConfidence;
  signals: EdgeSignal[];
}
