import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { NoopScanQueue } from "./infrastructure/queue/noop-scan-queue.js";
import { RabbitMqScanQueue } from "./infrastructure/queue/rabbitmq-scan-queue.js";
import { RedisSessionStore } from "./infrastructure/session/redis-session-store.js";
import { ScanSchedulerRepository } from "./modules/scans/scan-scheduler.repository.js";
import { ScanSchedulerService } from "./modules/scans/scan-scheduler.service.js";
import { ScanScheduler } from "./modules/scans/scan-scheduler.js";
import { ScanOutboxPublisher } from "./modules/scans/scan-outbox-publisher.js";
import { ScanRepository } from "./modules/scans/scan.repository.js";

const scanQueue =
  env.NODE_ENV === "test" ? new NoopScanQueue() : new RabbitMqScanQueue(env.RABBITMQ_URL);

const sessionStore = new RedisSessionStore(env.REDIS_URL);

const app = buildApp({
  scanQueue,
  sessionStore,
});

const scanScheduler = new ScanScheduler(
  new ScanSchedulerService(new ScanSchedulerRepository(), scanQueue, app.log),
  app.log,
);
const scanOutboxPublisher = new ScanOutboxPublisher(new ScanRepository(), scanQueue);

sessionStore.onError((error) => {
  app.log.error({ err: error }, "Redis session store error");
});

async function start() {
  try {
    await app.listen({
      port: env.API_PORT,
      host: "0.0.0.0",
    });
    scanScheduler.start();
    scanOutboxPublisher.start();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

app.addHook("onClose", () => {
  scanScheduler.stop();
  scanOutboxPublisher.stop();
});

void start();
