import Redis from "ioredis";
import PQueue from "p-queue";

import { compressGif, getGifInfo } from "./compression.js";
import * as db from "../db/client.js";
import type { JobStatusUpdate } from "../types.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
const DEFAULT_CONCURRENCY = parseInt(
  process.env.DEFAULT_CONCURRENCY || "2",
  10,
);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "10", 10);
const GIF_RETENTION_TTL = process.env.GIF_RETENTION_TTL;

class CompressionQueue {
  private queue: PQueue;
  private redis: Redis;
  private concurrency: number;

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, concurrency));
    this.queue = new PQueue({ concurrency: this.concurrency });
    this.redis = new Redis(REDIS_URL);

    this.redis.on("error", (err) => {
      console.error("[Queue] Redis error:", err.message);
    });

    console.log(`[Queue] Initialized with concurrency: ${this.concurrency}`);
  }

  async add(jobId: string): Promise<void> {
    console.log(`[Queue] Adding job: ${jobId}`);
    await this.queue.add(() => this.processJob(jobId));
    await this.publishQueueUpdate();
  }

  setConcurrency(value: number): void {
    const newConcurrency = Math.max(1, Math.min(MAX_CONCURRENCY, value));
    this.concurrency = newConcurrency;
    this.queue.concurrency = newConcurrency;
    console.log(`[Queue] Concurrency set to: ${newConcurrency}`);
    this.publishQueueUpdate();
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  getStatus(): { concurrency: number; active: number; pending: number } {
    return {
      concurrency: this.concurrency,
      active: this.queue.pending, // Currently running
      pending: this.queue.size, // Waiting to run
    };
  }

  private async processJob(jobId: string): Promise<void> {
    console.log(`[Queue] Processing job: ${jobId}`);

    // Update status to processing
    const now = new Date().toISOString();
    db.updateJob(jobId, { status: "processing", started_at: now });
    await this.publishUpdate(jobId, { status: "processing", progress: 0 });
    await this.publishQueueUpdate();

    try {
      const job = db.getJob(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      // Get original dimensions
      const originalInfo = getGifInfo(job.original_path);
      if (originalInfo.width > 0) {
        db.updateJob(jobId, {
          original_width: originalInfo.width,
          original_height: originalInfo.height,
        });
      }

      // Run compression
      const result = await compressGif(
        job.original_path,
        job.options,
        async (progress) => {
          db.updateJob(jobId, { progress });
          await this.publishUpdate(jobId, { status: "processing", progress });
        },
      );

      // Calculate reduction percentage
      const reductionPercent =
        ((job.original_size - result.size) / job.original_size) * 100;

      // Calculate expiration if TTL is set
      let expiresAt: string | null = null;
      if (GIF_RETENTION_TTL) {
        const ttlSeconds = parseInt(GIF_RETENTION_TTL, 10);
        const expirationDate = new Date(Date.now() + ttlSeconds * 1000);
        expiresAt = expirationDate.toISOString();
      }

      // Update completion
      db.updateJob(jobId, {
        status: "completed",
        progress: 100,
        compressed_path: result.path,
        compressed_size: result.size,
        compressed_width: result.width,
        compressed_height: result.height,
        reduction_percent: reductionPercent,
        completed_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

      await this.publishUpdate(jobId, {
        status: "completed",
        progress: 100,
        compressed_size: result.size,
        compressed_width: result.width,
        compressed_height: result.height,
        reduction_percent: reductionPercent,
      });

      console.log(
        `[Queue] Job completed: ${jobId} (${reductionPercent.toFixed(1)}% reduction)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Queue] Job failed: ${jobId}`, errorMessage);

      db.updateJob(jobId, {
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      });

      await this.publishUpdate(jobId, {
        status: "failed",
        progress: 0,
        error_message: errorMessage,
      });
    }

    await this.publishQueueUpdate();
  }

  private async publishUpdate(
    jobId: string,
    data: JobStatusUpdate,
  ): Promise<void> {
    try {
      await this.redis.publish(`gif:job:${jobId}:status`, JSON.stringify(data));
    } catch (err) {
      console.error("[Queue] Failed to publish update:", err);
    }
  }

  private async publishQueueUpdate(): Promise<void> {
    try {
      const status = this.getStatus();
      await this.redis.publish("gif:queue:status", JSON.stringify(status));
    } catch (err) {
      console.error("[Queue] Failed to publish queue update:", err);
    }
  }

  async shutdown(): Promise<void> {
    this.queue.pause();
    this.queue.clear();
    await this.redis.quit();
  }
}

// Singleton instance
export const compressionQueue = new CompressionQueue();
