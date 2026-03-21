import { BaseJobWorker } from "../base-job-worker.js";

import type { JobDefinition } from "@pluralscape/types";

/**
 * Polling-based job worker backed by a SqliteJobQueue.
 *
 * Polls the queue at a configurable interval and dispatches jobs to registered handlers.
 * Graceful shutdown aborts in-flight jobs via AbortController.
 */
export class SqliteJobWorker extends BaseJobWorker {
  // ── Adapter-specific poll ─────────────────────────────────────────

  protected override async poll(): Promise<void> {
    if (this.shouldSkipPoll()) return;

    const types = Array.from(this.handlers.keys());
    let job: JobDefinition | null;
    try {
      job = await this.queue.dequeue(types);
      this.handlePollSuccess();
    } catch (err) {
      this.handlePollFailure(err);
      return;
    }

    if (job === null) return;
    const heartbeatHandle = this.createHeartbeatHandle(job.id);
    void this.processJob(job, heartbeatHandle);
  }
}
