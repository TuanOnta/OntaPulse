export type ScanStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type ScanKind = "HTTP_PROBE" | "SECURITY_POSTURE" | "DNS_WATCH";
export type FindingCategory =
  | "HEADERS"
  | "COOKIES"
  | "CORS"
  | "REDIRECT"
  | "TLS"
  | "EXPOSED_FILES"
  | "DNS"
  | "EMAIL_AUTH";
export type FindingConfidence = "LOW" | "MEDIUM" | "HIGH";
export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}
export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  role?: WorkspaceRole;
  joinedAt?: string;
}
export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Monitor {
  id: string;
  projectId: string;
  name: string;
  targetUrl: string;
  intervalSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Scan {
  id: string;
  monitorId: string;
  /** Absent in responses of an older API; treat as `HTTP_PROBE`. */
  kind?: ScanKind;
  status: ScanStatus;
  statusCode?: number | null;
  responseTimeMs?: number | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}
export interface Finding {
  id: string;
  scanId: string;
  code: string;
  title: string;
  severity: FindingSeverity;
  description: string;
  recommendation?: string | null;
  evidence?: unknown;
  checkId?: string | null;
  category?: FindingCategory | null;
  confidence?: FindingConfidence | null;
  createdAt: string;
}
export interface SubCheck {
  name: string;
  state: "ran" | "skipped";
  reason: string | null;
}
export interface ScanDetail extends Scan {
  findings: Finding[];
  subChecks?: SubCheck[] | null;
}
export interface CheckSettings {
  monitorId: string;
  securityPostureEnabled: boolean;
  dnsWatchEnabled: boolean;
  pathProbesEnabled: boolean;
  pathProbesAcknowledgedAt: string | null;
}
export type EdgeLayer = "CDN" | "WAF" | "ANTI_BOT";
export type EdgeConfidence = "LOW" | "MEDIUM" | "HIGH";
export interface EdgeSignal {
  type: string;
  name: string;
}
export interface EdgeDetection {
  vendor: string;
  layer: EdgeLayer;
  confidence: EdgeConfidence;
  signals: EdgeSignal[];
}
export interface EdgeProfile {
  monitorId: string;
  scanId: string;
  challengeObserved: boolean;
  observedAt: string;
  detections: EdgeDetection[];
}
export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface QueueHealth {
  workspace: {
    pendingOutbox: number;
    queued: number;
    stuckRunning: number;
    failedRecently: number;
    generatedAt: string;
  };
  broker: { main: number; retry: number; deadLetter: number };
}
