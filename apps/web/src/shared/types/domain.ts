export type ScanStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
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
  createdAt: string;
}
export interface ScanDetail extends Scan {
  findings: Finding[];
}
export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string[] | undefined>;
  requestId?: string;
}
