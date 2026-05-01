/**
 * Redis-backed store for cancelled and dead-lettered jobs that BullMQ does
 * not natively retain. Each entry is JSON-serialized {@link StoredJobData}
 * under `${prefix}:cancelled:${jobId}`.
 *
 * The store enforces the fail-closed parsing contract: any read that returns
 * malformed JSON or a Zod-invalid shape surfaces as {@link QueueCorruptionError}.
 * `scanAllSafe` is the only exception — it accepts a per-entry `onCorrupt`
 * callback so aggregate scans (`listJobs`, `countJobs`) skip rather than
 * abort on a single bad row.
 */
import { brandId, extractErrorMessage } from "@pluralscape/types";

import { QueueCorruptionError } from "../../errors.js";

import { scanRedisKeys } from "./bullmq-job-queue.helpers.js";
import { StoredJobDataSchema, type StoredJobData } from "./job-mapper.js";

import type { JobId } from "@pluralscape/types";
import type IORedis from "ioredis";

export class CancelledJobStore {
  private readonly redis: IORedis;
  private readonly prefix: string;

  constructor(redis: IORedis, prefix: string) {
    this.redis = redis;
    this.prefix = prefix;
  }

  private keyFor(jobId: JobId): string {
    return `${this.prefix}:cancelled:${jobId}`;
  }

  /** Read a cancelled job's data. Throws QueueCorruptionError on invalid JSON or schema. */
  async read(jobId: JobId): Promise<StoredJobData | null> {
    const raw = await this.redis.get(this.keyFor(jobId));
    if (raw === null) return null;
    try {
      return StoredJobDataSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new QueueCorruptionError(jobId, extractErrorMessage(err), { cause: err });
    }
  }

  async write(jobId: JobId, data: StoredJobData): Promise<void> {
    await this.redis.set(this.keyFor(jobId), JSON.stringify(data));
  }

  async delete(jobId: JobId): Promise<void> {
    await this.redis.del(this.keyFor(jobId));
  }

  /** All cancelled job IDs (no parsing). */
  async scanIds(): Promise<JobId[]> {
    const keys = await scanRedisKeys(this.redis, `${this.prefix}:cancelled:*`);
    const cancelledPrefix = `${this.prefix}:cancelled:`;
    return keys.map((k) => brandId<JobId>(k.replace(cancelledPrefix, "")));
  }

  /**
   * All cancelled jobs as parsed data. Calls `onCorrupt` for any entry that
   * fails parsing instead of throwing — used by listJobs/countJobs which
   * prefer partial results to a hard failure on aggregate scans.
   */
  async scanAllSafe(
    onCorrupt: (id: JobId) => void,
  ): Promise<Array<{ id: JobId; data: StoredJobData }>> {
    const ids = await this.scanIds();
    const out: Array<{ id: JobId; data: StoredJobData }> = [];
    for (const id of ids) {
      const raw = await this.redis.get(this.keyFor(id));
      if (raw === null) continue;
      try {
        out.push({ id, data: StoredJobDataSchema.parse(JSON.parse(raw)) });
      } catch {
        onCorrupt(id);
      }
    }
    return out;
  }

  /** Bulk delete every cancelled key. Used by `obliterate()`. */
  async deleteAll(): Promise<readonly string[]> {
    const keys = await scanRedisKeys(this.redis, `${this.prefix}:cancelled:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    return keys;
  }
}
