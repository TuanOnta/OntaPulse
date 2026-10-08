import { expect, test } from "@playwright/test";

const createdAt = "2026-09-22T00:00:00.000Z";

test("registers, creates a monitor, triggers a scan, and views its result", async ({
  page,
  context,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const workspace = {
    id: "workspace-1",
    name: "OntaPulse Workspace",
    role: "OWNER",
    joinedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
  const project = {
    id: "project-1",
    workspaceId: workspace.id,
    name: "Public API",
    description: "Customer-facing service",
    createdAt,
    updatedAt: createdAt,
  };
  const monitor = {
    id: "monitor-1",
    projectId: project.id,
    name: "Marketing homepage",
    targetUrl: "https://example.com",
    intervalSeconds: 300,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
  const scan = {
    id: "scan-1",
    monitorId: monitor.id,
    status: "SUCCEEDED",
    statusCode: 200,
    responseTimeMs: 120,
    createdAt,
    startedAt: createdAt,
    finishedAt: createdAt,
  };
  let projects: (typeof project)[] = [];
  let monitors: (typeof monitor)[] = [];

  await context.route(
    /\/api\/(?:auth|workspaces|projects|monitors|scans)(?:\/|$)/,
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const fulfill = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

      if (path === "/api/auth/me") return fulfill({ code: "UNAUTHENTICATED" }, 401);
      if (path === "/api/auth/register" && method === "POST") {
        return fulfill({
          user: { id: "user-1", name: "Person", email: "person@example.com" },
          workspace,
        });
      }
      if (path === "/api/workspaces") return fulfill([workspace]);
      if (path === `/api/workspaces/${workspace.id}/projects`) {
        if (method === "POST") {
          projects = [project];
          return fulfill(project, 201);
        }
        return fulfill(projects);
      }
      if (path === `/api/workspaces/${workspace.id}/members`) return fulfill([]);
      if (path === `/api/projects/${project.id}/monitors`) {
        if (method === "POST") {
          monitors = [monitor];
          return fulfill(monitor, 201);
        }
        return fulfill(monitors);
      }
      if (path === `/api/monitors/${monitor.id}/scans`) {
        if (method === "POST") return fulfill(scan, 202);
        return fulfill([scan]);
      }
      if (path === `/api/scans/${scan.id}`) return fulfill({ ...scan, findings: [] });

      return fulfill({ code: "NOT_FOUND" }, 404);
    },
  );

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("OntaPulse");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL("/register");
  const form = page.getByRole("tabpanel");
  await form.getByLabel("Name").fill("Person");
  await form.getByLabel("Email").fill("person@example.com");
  await form.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Your workspace is ready.");

  // The success view stays for a moment before the redirect.
  await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  await page.getByRole("link", { name: `Open workspace ${workspace.name}` }).click();
  await expect(page).toHaveURL(`/workspaces/${workspace.id}`);

  await page.getByRole("button", { name: "New project" }).first().click();
  const projectDialog = page.getByRole("dialog");
  await projectDialog.getByLabel("Name").fill(project.name);
  await projectDialog.getByLabel(/Description/).fill(project.description);
  await projectDialog.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: /Public API/ }).click();

  await page.locator("#monitor-name").fill(monitor.name);
  await page.locator("#target-url").fill(monitor.targetUrl);
  await page.getByRole("button", { name: "Add monitor" }).click();
  await page.getByRole("link", { name: /Marketing homepage/ }).click();

  await page.getByRole("button", { name: "Run scan" }).click();
  await page.getByRole("link", { name: /Inspect/ }).click();
  await expect(page.getByRole("heading", { name: "Run scan-1" })).toBeVisible();
  await expect(page.getByText("120 ms")).toBeVisible();
  await expect(page.getByText("No findings")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
