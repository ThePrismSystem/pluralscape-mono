import type { JobQueue } from "../job-queue.js";
import type { JobDefinition, JobId, JobType, SystemId } from "@pluralscape/types";

/** Filter options for listing dead-lettered jobs. */
export interface DLQFilter {
  readonly type?: JobType;
  readonly systemId?: SystemId;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Thin wrapper over a JobQueue providing dead-letter queue management.
 *
 * All operations delegate to the underlying queue's existing methods,
 * surfacing a focused API for DLQ inspection and administration.
 */
export class DLQManager {
  constructor(private readonly queue: JobQueue) {}

  /** Lists dead-lettered jobs, optionally filtered. */
  async list(filter?: DLQFilter): Promise<readonly JobDefinition[]> {
    return this.queue.listDeadLettered(filter);
  }

  /** Replays a single dead-lettered job by resetting it to pending. */
  async replay(jobId: JobId): Promise<JobDefinition> {
    return this.queue.retry(jobId);
  }

  /** Replays all dead-lettered jobs matching the optional filter. */
  async replayAll(
    filter?: Pick<DLQFilter, "type" | "systemId">,
  ): Promise<readonly JobDefinition[]> {
    const deadLettered = await this.queue.listDeadLettered(filter);
    const results: JobDefinition[] = [];
    for (const job of deadLettered) {
      results.push(await this.queue.retry(job.id));
    }
    return results;
  }

  /**
   * Purges dead-lettered jobs by cancelling them.
   *
   * Uses the `cancel()` transition (`dead-letter -> cancelled`) to
   * follow the non-destructive data principle — jobs are archived, not deleted.
   */
  async purge(filter?: Pick<DLQFilter, "type" | "systemId">): Promise<number> {
    const deadLettered = await this.queue.listDeadLettered(filter);
    let count = 0;
    for (const job of deadLettered) {
      await this.queue.cancel(job.id);
      count++;
    }
    return count;
  }

  /** Returns the count of dead-lettered jobs matching the optional filter. */
  async depth(filter?: Pick<DLQFilter, "type" | "systemId">): Promise<number> {
    const deadLettered = await this.queue.listDeadLettered(filter);
    return deadLettered.length;
  }
}
