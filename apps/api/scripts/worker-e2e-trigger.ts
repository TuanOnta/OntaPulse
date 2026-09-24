// Called only by the explicitly selected worker infrastructure suite.
import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { RabbitMqScanQueue } from "../src/infrastructure/queue/rabbitmq-scan-queue.js";
import { SESSION_COOKIE_NAME } from "../src/infrastructure/session/session.constants.js";

const broker = process.env.RABBITMQ_URL;
const database = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV !== "test" || !database.pathname.endsWith("_test")) {
  throw new Error("Worker E2E requires the dedicated test database");
}
if (!broker || !decodeURIComponent(new URL(broker).pathname).startsWith("/worker-e2e-")) {
  throw new Error("Worker E2E requires an isolated RabbitMQ vhost");
}

const userId = process.env.E2E_USER_ID;
if (!userId) throw new Error("Worker E2E requires an authenticated test user");

const app = buildApp({
  scanQueue: new RabbitMqScanQueue(broker),
  sessionStore: {
    create: async () => "worker-e2e-session",
    findUserId: async (token) => (token === "worker-e2e-session" ? userId : null),
    delete: async () => {},
    close: async () => {},
  },
});
try {
  const monitor = await prisma.monitor.create({
    data: {
      projectId: process.env.E2E_PROJECT_ID!,
      name: "Worker E2E",
      targetUrl: process.env.E2E_TARGET_URL!,
    },
  });
  const response = await app.inject({
    method: "POST",
    url: `/api/monitors/${monitor.id}/scans`,
    headers: { cookie: `${SESSION_COOKIE_NAME}=worker-e2e-session` },
  });
  if (response.statusCode !== 202) throw new Error(`Trigger returned ${response.statusCode}`);
  console.log(JSON.stringify({ scan_id: response.json().id, monitor_id: monitor.id }));
} finally {
  await app.close();
}
