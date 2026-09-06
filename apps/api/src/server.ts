import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { NoopScanQueue } from "./infrastructure/queue/noop-scan-queue.js";
import { RabbitMqScanQueue } from "./infrastructure/queue/rabbitmq-scan-queue.js";
import { RedisSessionStore } from "./infrastructure/session/redis-session-store.js";

const scanQueue =
  env.NODE_ENV === "test" ? new NoopScanQueue() : new RabbitMqScanQueue(env.RABBITMQ_URL);

const sessionStore = new RedisSessionStore(env.REDIS_URL);

const app = buildApp({
  scanQueue,
  sessionStore,
});

sessionStore.onError((error) => {
  app.log.error({ err: error }, "Redis session store error");
});

async function start() {
  try {
    await app.listen({
      port: env.API_PORT,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
