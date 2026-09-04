import { once } from "node:events";
import * as amqp from "amqplib";
import type { ChannelModel, ConfirmChannel } from "amqplib";

import type { ScanJob, ScanQueue } from "./scan-queue.js";

const SCAN_EXCHANGE = "scan";
const SCAN_QUEUE = "scan.jobs";
const SCAN_ROUTING_KEY = "scan.requested";

const SCAN_DEAD_LETTER_EXCHANGE = "scan.dlx";
const SCAN_DEAD_LETTER_QUEUE = "scan.jobs.dead";
const SCAN_DEAD_LETTER_ROUTING_KEY = "scan.dead";

export class RabbitMqScanQueue implements ScanQueue {
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
