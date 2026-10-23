import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  DNS_WATCH_SCHEDULE_INTERVAL_SECONDS,
  DNS_WATCH_SCHEDULE_MIN_INTERVAL_SECONDS,
  SCHEDULED_KINDS,
  SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS,
  SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS,
  SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR,
  type ScheduledScanKind,
} from "../src/modules/scans/scan-kinds.js";
import {
  CheckSchedulerRepository,
  ScanSchedulerRepository,
  type DueCheck,
} from "../src/modules/scans/scan-scheduler.repository.js";
import { ScanSchedulerService } from "../src/modules/scans/scan-scheduler.service.js";
import { createTestIdentity, resetDatabase, TEST_WORKSPACE_ID } from "./helpers/database.js";

const NOW = new Date("2026-10-23T00:00:00.000Z");
const PAST = new Date("2026-10-22T23:00:00.000Z");
const FUTURE = new Date("2026-10-23T01:00:00.000Z");

const infoLogs: Array<{ context: Record<string, unknown>; message: string }> = [];
const errorLogs: Array<{ context: Record<string, unknown>; message: string }> = [];
const logger = {
  error: (context: object, message: string) => {
    errorLogs.push({ context: context as Record<string, unknown>, message });
  },
  info: (context: object, message: string) => {
    infoLogs.push({ context: context as Record<string, unknown>, message });
  },
};

const checkLogs = () =>
  infoLogs.filter((log) => log.message === "Check scan scheduler run completed");

interface MonitorOptions {
  isActive?: boolean;
  securityEnabled?: boolean;
  securityNext?: Date | null;
  dnsEnabled?: boolean;
  dnsNext?: Date | null;
}

async function createMonitor(options: MonitorOptions = {}) {
  const project = await prisma.project.create({
    data: { workspaceId: TEST_WORKSPACE_ID, name: "Check Scheduler Project" },
  });
  const monitor = await prisma.monitor.create({
    data: {
      projectId: project.id,
      name: "Check Scheduler Monitor",
      targetUrl: `https://example.com/${crypto.randomUUID()}`,
      // The availability clock is in the future so only the check pass has work.
      nextScheduledAt: FUTURE,
      isActive: options.isActive ?? true,
    },
  });
  await prisma.monitorCheckSettings.create({
    data: {
      monitorId: monitor.id,
      securityPostureEnabled: options.securityEnabled ?? false,
      securityNextScheduledAt: options.securityNext ?? null,
      dnsWatchEnabled: options.dnsEnabled ?? false,
      dnsNextScheduledAt: options.dnsNext ?? null,
    },
  });
  return monitor;
}

const service = () => new ScanSchedulerService(new ScanSchedulerRepository(), logger);
const settingsOf = (monitorId: string) =>
  prisma.monitorCheckSettings.findUniqueOrThrow({ where: { monitorId } });

describe("Recurring security and DNS scans", () => {
  beforeEach(async () => {
    infoLogs.length = 0;
    errorLogs.length = 0;
    await resetDatabase();
    await createTestIdentity();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("keeps the scheduled intervals above the catalog minimum", () => {
    expect(SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS).toBeGreaterThanOrEqual(
      SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS,
    );
    expect(DNS_WATCH_SCHEDULE_INTERVAL_SECONDS).toBeGreaterThanOrEqual(
      DNS_WATCH_SCHEDULE_MIN_INTERVAL_SECONDS,
    );
    for (const limits of Object.values(SCHEDULED_KINDS)) {
      expect(limits.intervalSeconds).toBeGreaterThanOrEqual(limits.minIntervalSeconds);
    }
  });

  it("queues a due security scan with its outbox event and moves the schedule one interval on", async () => {
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });

    await expect(service().runOnce(NOW)).resolves.toBe(0);

    const scans = await prisma.scan.findMany({ where: { monitorId: monitor.id } });
    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({ kind: "SECURITY_POSTURE", status: "QUEUED" });
    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scans[0]!.id } }),
    ).resolves.toMatchObject({ monitorId: monitor.id, status: "PENDING" });
    expect((await settingsOf(monitor.id)).securityNextScheduledAt).toEqual(
      new Date(NOW.getTime() + SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS * 1_000),
    );
    expect(checkLogs()).toEqual([
      {
        context: {
          kinds: {
            SECURITY_POSTURE: {
              dueCount: 1,
              scheduledCount: 1,
              skippedCount: 0,
              skipped: { workspace_limit: 0, in_flight: 0 },
              failedCount: 0,
            },
          },
          durationMs: expect.any(Number),
        },
        message: "Check scan scheduler run completed",
      },
    ]);
  });

  it("queues a due DNS scan and moves its own schedule only", async () => {
    const monitor = await createMonitor({
      dnsEnabled: true,
      dnsNext: PAST,
      securityEnabled: true,
      securityNext: FUTURE,
    });

    await service().runOnce(NOW);

    const scans = await prisma.scan.findMany({ where: { monitorId: monitor.id } });
    expect(scans.map((scan) => scan.kind)).toEqual(["DNS_WATCH"]);
    const settings = await settingsOf(monitor.id);
    expect(settings.dnsNextScheduledAt).toEqual(
      new Date(NOW.getTime() + DNS_WATCH_SCHEDULE_INTERVAL_SECONDS * 1_000),
    );
    expect(settings.securityNextScheduledAt).toEqual(FUTURE);
  });

  it("leaves checks that are off, not due, or on an inactive monitor alone", async () => {
    await createMonitor({
      securityEnabled: false,
      securityNext: PAST,
      dnsEnabled: false,
      dnsNext: PAST,
    });
    await createMonitor({
      securityEnabled: true,
      securityNext: FUTURE,
      dnsEnabled: true,
      dnsNext: FUTURE,
    });
    await createMonitor({
      isActive: false,
      securityEnabled: true,
      securityNext: PAST,
      dnsEnabled: true,
      dnsNext: PAST,
    });

    await service().runOnce(NOW);

    await expect(prisma.scan.count()).resolves.toBe(0);
    expect(checkLogs()).toEqual([]);
  });

  it("does not count recurring scans in the availability result", async () => {
    await createMonitor({ securityEnabled: true, securityNext: PAST });
    await prisma.monitor.updateMany({ data: { nextScheduledAt: PAST } });

    await expect(service().runOnce(NOW)).resolves.toBe(1);

    const kinds = (await prisma.scan.findMany()).map((scan) => scan.kind).sort();
    expect(kinds).toEqual(["HTTP_PROBE", "SECURITY_POSTURE"]);
  });

  it("queues one scan per due occurrence when schedulers overlap", async () => {
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });

    await Promise.all([service().runOnce(NOW), service().runOnce(NOW)]);

    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(1);
    await expect(prisma.scanOutboxEvent.count()).resolves.toBe(1);
  });

  it("does not queue the same occurrence again on the next cycle", async () => {
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });

    await service().runOnce(NOW);
    await service().runOnce(new Date(NOW.getTime() + 10_000));

    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(1);
  });

  it("skips an occurrence while a scan of that kind is still in flight, and advances the schedule", async () => {
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });
    await prisma.scan.create({
      data: { monitorId: monitor.id, kind: "SECURITY_POSTURE", status: "RUNNING" },
    });

    await service().runOnce(NOW);

    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(1);
    expect((await settingsOf(monitor.id)).securityNextScheduledAt).toEqual(
      new Date(NOW.getTime() + SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS * 1_000),
    );
    expect(checkLogs()[0]?.context.kinds).toMatchObject({
      SECURITY_POSTURE: { scheduledCount: 0, skippedCount: 1, skipped: { in_flight: 1 } },
    });
  });

  it("does not let an in-flight scan of another kind block the occurrence", async () => {
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });
    await prisma.scan.create({
      data: { monitorId: monitor.id, kind: "DNS_WATCH", status: "RUNNING" },
    });

    await service().runOnce(NOW);

    await expect(
      prisma.scan.count({ where: { monitorId: monitor.id, kind: "SECURITY_POSTURE" } }),
    ).resolves.toBe(1);
  });

  it("skips the occurrence when the workspace is at its hourly limit, and advances the schedule", async () => {
    const other = await createMonitor();
    await prisma.scan.createMany({
      data: Array.from({ length: SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR }, (_, index) => ({
        monitorId: other.id,
        kind: "SECURITY_POSTURE" as const,
        status: "SUCCEEDED" as const,
        createdAt: new Date(NOW.getTime() - (index + 1) * 1_000),
      })),
    });
    const monitor = await createMonitor({ securityEnabled: true, securityNext: PAST });

    await service().runOnce(NOW);

    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(0);
    expect((await settingsOf(monitor.id)).securityNextScheduledAt).toEqual(
      new Date(NOW.getTime() + SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS * 1_000),
    );
    expect(checkLogs()[0]?.context.kinds).toMatchObject({
      SECURITY_POSTURE: { skipped: { workspace_limit: 1 } },
    });
  });

  it("keeps going when one monitor fails, and logs counts and ids only", async () => {
    const failing = await createMonitor({ dnsEnabled: true, dnsNext: PAST });
    const healthy = await createMonitor({ dnsEnabled: true, dnsNext: PAST });

    class FlakyRepository extends CheckSchedulerRepository {
      override claimAndCreateCheckScan(kind: ScheduledScanKind, due: DueCheck, now: Date) {
        if (due.monitorId === failing.id) {
          return Promise.reject(new Error("database went away"));
        }
        return super.claimAndCreateCheckScan(kind, due, now);
      }
    }
    const scheduler = new ScanSchedulerService(
      new ScanSchedulerRepository(),
      logger,
      new FlakyRepository(),
    );

    await scheduler.runOnce(NOW);

    await expect(prisma.scan.count({ where: { monitorId: healthy.id } })).resolves.toBe(1);
    await expect(prisma.scan.count({ where: { monitorId: failing.id } })).resolves.toBe(0);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0]).toMatchObject({
      message: "Scheduled check scan failed",
      context: { kind: "DNS_WATCH", monitorId: failing.id },
    });
    expect(checkLogs()[0]?.context.kinds).toMatchObject({
      DNS_WATCH: { dueCount: 2, scheduledCount: 1, failedCount: 1 },
    });
  });

  it("finds due checks per kind", async () => {
    const repository = new CheckSchedulerRepository();
    await createMonitor({ securityEnabled: true, securityNext: PAST });

    await expect(repository.findDueChecks("SECURITY_POSTURE", NOW)).resolves.toHaveLength(1);
    await expect(repository.findDueChecks("DNS_WATCH", NOW)).resolves.toHaveLength(0);
  });
});
