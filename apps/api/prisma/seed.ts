import { PrismaPg } from "@prisma/adapter-pg";
import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "postgres"]);

const projects = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "OntaPulse Storefront Demo",
    description: "Public storefront and checkout monitoring examples.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "OntaPulse Internal Services Demo",
    description: null,
  },
] satisfies Prisma.ProjectUncheckedCreateInput[];

const monitors = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    projectId: projects[0].id,
    name: "Storefront",
    targetUrl: "https://shop.example.com",
    intervalSeconds: 60,
    isActive: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    projectId: projects[0].id,
    name: "Checkout API",
    targetUrl: "https://checkout.example.com/health",
    intervalSeconds: 120,
    isActive: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    projectId: projects[1].id,
    name: "Legacy Admin",
    targetUrl: "https://admin.example.com",
    intervalSeconds: 900,
    isActive: false,
  },
] satisfies Prisma.MonitorUncheckedCreateInput[];

const scans = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    monitorId: monitors[0].id,
    status: "QUEUED",
    statusCode: null,
    responseTimeMs: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-09-04T08:00:00.000Z"),
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    monitorId: monitors[1].id,
    status: "RUNNING",
    statusCode: null,
    responseTimeMs: null,
    errorMessage: null,
    startedAt: new Date("2026-09-04T08:05:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-09-04T08:05:00.000Z"),
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    monitorId: monitors[0].id,
    status: "SUCCEEDED",
    statusCode: 200,
    responseTimeMs: 184,
    errorMessage: null,
    startedAt: new Date("2026-09-04T07:55:00.000Z"),
    finishedAt: new Date("2026-09-04T07:55:00.184Z"),
    createdAt: new Date("2026-09-04T07:55:00.000Z"),
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    monitorId: monitors[1].id,
    status: "FAILED",
    statusCode: null,
    responseTimeMs: 5_000,
    errorMessage: "Request timed out",
    startedAt: new Date("2026-09-04T07:50:00.000Z"),
    finishedAt: new Date("2026-09-04T07:50:05.000Z"),
    createdAt: new Date("2026-09-04T07:50:00.000Z"),
  },
] satisfies Prisma.ScanUncheckedCreateInput[];

const findings = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    scanId: scans[2].id,
    code: "VERBOSE_SERVER_HEADER",
    title: "Verbose server header",
    severity: "LOW",
    description: "The response exposes the web server product and version.",
    recommendation: "Remove version details from the Server response header.",
    evidence: { header: "server", value: "example-server/1.0" },
    createdAt: new Date("2026-09-04T07:55:00.200Z"),
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    scanId: scans[2].id,
    code: "MISSING_X_CONTENT_TYPE_OPTIONS",
    title: "Missing X-Content-Type-Options header",
    severity: "MEDIUM",
    description: "The response does not prevent MIME type sniffing.",
    recommendation: "Return X-Content-Type-Options with the value nosniff.",
    evidence: { header: "x-content-type-options", present: false },
    createdAt: new Date("2026-09-04T07:55:00.210Z"),
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    scanId: scans[2].id,
    code: "MISSING_CONTENT_SECURITY_POLICY",
    title: "Missing Content-Security-Policy header",
    severity: "HIGH",
    description: "The response does not define a Content-Security-Policy.",
    recommendation: "Configure a restrictive Content-Security-Policy header.",
    evidence: { header: "content-security-policy", present: false },
    createdAt: new Date("2026-09-04T07:55:00.220Z"),
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    scanId: scans[2].id,
    code: "TLS_CERTIFICATE_EXPIRED",
    title: "Expired TLS certificate",
    severity: "CRITICAL",
    description: "The endpoint presented an expired TLS certificate.",
    recommendation: "Renew the certificate and verify automated renewal.",
    evidence: { expiredAt: "2026-09-01T00:00:00.000Z" },
    createdAt: new Date("2026-09-04T07:55:00.230Z"),
  },
] satisfies Prisma.ScanFindingUncheckedCreateInput[];

export function assertSeedAllowed(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.NODE_ENV !== "development") {
    throw new Error("Database seeding is only allowed in development");
  }

  if (!environment.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database seeding");
  }

  const databaseUrl = new URL(environment.DATABASE_URL);
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));

  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname) || databaseName.endsWith("_test")) {
    throw new Error("Database seeding is only allowed for a local development database");
  }

  return environment.DATABASE_URL;
}

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const project of projects) {
      const { id, ...data } = project;
      await transaction.project.upsert({ where: { id }, update: data, create: project });
    }

    for (const monitor of monitors) {
      const { id, ...data } = monitor;
      await transaction.monitor.upsert({ where: { id }, update: data, create: monitor });
    }

    for (const scan of scans) {
      const { id, ...data } = scan;
      await transaction.scan.upsert({ where: { id }, update: data, create: scan });
    }

    for (const finding of findings) {
      const { id, ...data } = finding;
      await transaction.scanFinding.upsert({ where: { id }, update: data, create: finding });
    }
  });
}

async function main(): Promise<void> {
  const databaseUrl = assertSeedAllowed();
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedDatabase(prisma);
    console.log(
      JSON.stringify({
        level: "info",
        event: "database.seeded",
        projects: projects.length,
        monitors: monitors.length,
        scans: scans.length,
        findings: findings.length,
      }),
    );
  } catch {
    console.error(JSON.stringify({ level: "error", event: "database.seed_failed" }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entryPoint === import.meta.url) {
  void main();
}
