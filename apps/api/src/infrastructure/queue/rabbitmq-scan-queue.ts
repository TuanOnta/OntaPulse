import { once } from "node:events";
import * as amqp from "amqplib";
import type { ChannelModel, ConfirmChannel } from "amqplib";

import type {
  DeadLetterRedriveResult,
  QueueHealth,
  ScanJob,
  ScanQueue,
  ScanQueueOperations,
} from "./scan-queue.js";

const SCAN_EXCHANGE = "scan";
const SCAN_QUEUE = "scan.jobs";
const SCAN_ROUTING_KEY = "scan.requested";

const SCAN_DEAD_LETTER_EXCHANGE = "scan.dlx";
const SCAN_DEAD_LETTER_QUEUE = "scan.jobs.dead";
const SCAN_DEAD_LETTER_ROUTING_KEY = "scan.dead";

export class RabbitMqScanQueue implements ScanQueue, ScanQueueOperations {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting: Promise<ConfirmChannel> | null = null;

  constructor(private readonly url: string) {}

  async enqueue(job: ScanJob): Promise<void> {
    const channel = await this.getChannel();
    const message = Buffer.from(JSON.stringify(job));

    const accepted = channel.publish(SCAN_EXCHANGE, SCAN_ROUTING_KEY, message, {
      persistent: true,
      contentType: "application/json",
      contentEncoding: "utf-8",
      messageId: job.scanId,
      type: SCAN_ROUTING_KEY,
      timestamp: Date.now(),
    });

    if (!accepted) {
      await once(channel, "drain");
    }

    await channel.waitForConfirms();
  }

  async close(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;
    this.connecting = null;

    if (channel) {
      await channel.close();
    }

    if (connection) {
      await connection.close();
    }
  }

  async health(): Promise<QueueHealth> {
    const channel = await this.getChannel();
    const [main, retry5, retry30, retry120, deadLetter] = await Promise.all([
      channel.checkQueue(SCAN_QUEUE),
      channel.checkQueue("scan.jobs.retry.5s"),
      channel.checkQueue("scan.jobs.retry.30s"),
      channel.checkQueue("scan.jobs.retry.120s"),
      channel.checkQueue(SCAN_DEAD_LETTER_QUEUE),
    ]);
    return {
      main: main.messageCount,
      retry: retry5.messageCount + retry30.messageCount + retry120.messageCount,
      deadLetter: deadLetter.messageCount,
    };
  }

  async redriveDeadLetter(job: ScanJob): Promise<DeadLetterRedriveResult> {
    const channel = await this.getChannel();
    const message = await channel.get(SCAN_DEAD_LETTER_QUEUE, { noAck: false });
    if (!message) return "EMPTY";

    const payload = parseScanJob(message.content);
    if (!payload) {
      channel.nack(message, false, true);
      return "INVALID_MESSAGE";
    }
    if (payload.scanId !== job.scanId || payload.monitorId !== job.monitorId) {
      channel.nack(message, false, true);
      return "HEAD_MISMATCH";
    }

    await this.enqueue(job);
    channel.ack(message);
    return "REDRIVEN";
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connecting) {
      this.connecting = this.connect();
    }

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async connect(): Promise<ConfirmChannel> {
    const connection = await amqp.connect(this.url);
    const channel = await connection.createConfirmChannel();

    await channel.assertExchange(SCAN_EXCHANGE, "direct", {
      durable: true,
    });

    await channel.assertExchange(SCAN_DEAD_LETTER_EXCHANGE, "direct", {
      durable: true,
    });

    await channel.assertQueue(SCAN_DEAD_LETTER_QUEUE, {
      durable: true,
    });

    await channel.bindQueue(
      SCAN_DEAD_LETTER_QUEUE,
      SCAN_DEAD_LETTER_EXCHANGE,
      SCAN_DEAD_LETTER_ROUTING_KEY,
    );

    await channel.assertQueue(SCAN_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": SCAN_DEAD_LETTER_EXCHANGE,
        "x-dead-letter-routing-key": SCAN_DEAD_LETTER_ROUTING_KEY,
      },
    });

    await channel.bindQueue(SCAN_QUEUE, SCAN_EXCHANGE, SCAN_ROUTING_KEY);

    await channel.assertExchange("scan.retry", "direct", { durable: true });
    for (const delay of [5, 30, 120]) {
      const queue = `scan.jobs.retry.${delay}s`;
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          "x-queue-type": "quorum",
          "x-message-ttl": delay * 1000,
          "x-dead-letter-exchange": SCAN_EXCHANGE,
          "x-dead-letter-routing-key": SCAN_ROUTING_KEY,
          "x-dead-letter-strategy": "at-least-once",
          "x-overflow": "reject-publish",
        },
      });
      await channel.bindQueue(queue, "scan.retry", `scan.retry.${delay}s`);
    }

    connection.on("close", () => {
      this.connection = null;
      this.channel = null;
    });

    channel.on("close", () => {
      this.channel = null;
    });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }
}

function parseScanJob(content: Buffer): ScanJob | null {
  try {
    const value: unknown = JSON.parse(content.toString("utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "scanId" in value &&
      "monitorId" in value &&
      typeof value.scanId === "string" &&
      typeof value.monitorId === "string"
    ) {
      return { scanId: value.scanId, monitorId: value.monitorId };
    }
  } catch {}
  return null;
}
