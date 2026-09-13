import type {
  ApiErrorShape,
  Monitor,
  Project,
  Scan,
  ScanDetail,
  User,
  Workspace,
  WorkspaceMember,
} from "@/shared/types/domain";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(readonly payload: ApiErrorShape) {
    super(payload.message);
  }
}

function isApiErrorShape(value: unknown): value is ApiErrorShape {
  return typeof value === "object" && value !== null && "code" in value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const rawBody = await response.text();
  let body: T | ApiErrorShape | undefined;
  try {
    body = rawBody ? (JSON.parse(rawBody) as T | ApiErrorShape) : undefined;
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    throw new ApiError(
      (isApiErrorShape(body)
        ? body
        : {
            statusCode: response.status,
            code: "API_UNAVAILABLE",
            message: "The API is unavailable. Check that the local API is running.",
          }) as ApiErrorShape,
    );
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: User }>("/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ user: User; workspace: Workspace }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  workspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (name: string) =>
    request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  workspaceMembers: (workspaceId: string) =>
    request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
  addWorkspaceMember: (workspaceId: string, email: string) =>
    request<WorkspaceMember>(`/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  updateWorkspaceMemberRole: (workspaceId: string, userId: string, role: "ADMIN" | "MEMBER") =>
    request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeWorkspaceMember: (workspaceId: string, userId: string) =>
    request<void>(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
  projects: (workspaceId: string) => request<Project[]>(`/workspaces/${workspaceId}/projects`),
  createProject: (workspaceId: string, name: string, description?: string) =>
    request<Project>(`/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify({ name, description: description || undefined }),
    }),
  monitors: (projectId: string) => request<Monitor[]>(`/projects/${projectId}/monitors`),
  createMonitor: (
    projectId: string,
    input: Pick<Monitor, "name" | "targetUrl" | "intervalSeconds">,
  ) =>
    request<Monitor>(`/projects/${projectId}/monitors`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  triggerScan: (monitorId: string) =>
    request<Scan>(`/monitors/${monitorId}/scans`, { method: "POST" }),
  scans: (monitorId: string) => request<Scan[]>(`/monitors/${monitorId}/scans`),
  scan: (scanId: string) => request<ScanDetail>(`/scans/${scanId}`),
};
