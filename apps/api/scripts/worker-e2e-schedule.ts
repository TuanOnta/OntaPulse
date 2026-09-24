// Called only by the explicitly selected worker infrastructure suite.
import { prisma } from "../src/infrastructure/database/prisma.js";
import { RabbitMqScanQueue } from "../src/infrastructure/queue/rabbitmq-scan-queue.js";
import { ScanSchedulerRepository } from "../src/modules/scans/scan-scheduler.repository.js";
import { ScanSchedulerService } from "../src/modules/scans/scan-scheduler.service.js";

const broker = process.env.RABBITMQ_URL;
const database = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV !== "test" || !database.pathname.endsWith("_test")) {
  throw new Error("Worker E2E requires the dedicated test database");
}
if (!broker || !decodeURIComponent(new URL(broker).pathname).startsWith("/worker-e2e-")) {
  throw new Error("Worker E2E requires an isolated RabbitMQ vhost");
}

const monitor = await prisma.monitor.create({
  data: {
    projectId: process.env.E2E_PROJECT_ID!,
    name: "Worker scheduler E2E",
    targetUrl: process.env.E2E_TARGET_URL!,
    nextScheduledAt: new Date(),
  },
});
const scanQueue = new RabbitMqScanQueue(broker);
const logger = {
  error: () => {},
  info: () => {},
};

try {
  const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), scanQueue, logger);
  const scheduled = await scheduler.runOnce(new Date());
  if (scheduled !== 1) throw new Error(`Scheduler created ${scheduled} scans`);

  const scan = await prisma.scan.findFirst({
    where: { monitorId: monitor.id },
    orderBy: { createdAt: "desc" },
  });
  if (!scan) throw new Error("Scheduler did not persist a scan");

  console.log(JSON.stringify({ scan_id: scan.id, monitor_id: monitor.id }));
} finally {
  await scanQueue.close();
}
