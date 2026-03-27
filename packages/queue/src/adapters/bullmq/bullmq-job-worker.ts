import { extractErrorMessage } from "@pluralscape/types";
import { now } from "@pluralscape/types/runtime";
import { Worker } from "bullmq";

import { BASE_36 } from "../../queue.constants.js";
import { BaseJobWorker } from "../base-job-worker.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { HeartbeatHandle } from "../../heartbeat.js";
import type { JobQueue } from "../../job-queue.js";
import type { BaseJobWorkerOptions } from "../base-job-worker.js";
import type { JobDefinition, JobId } from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";

/**
 * BullMQ-backed implementation of JobWorker.
 *
 * Uses a BullMQ Worker in manual-fetch mode (no processor), polling
 * with `getNextJob()` for full control over job state transitions.
 */
export class BullMQJobWorker extends BaseJobWorker {
  private readonly queueName: string;
  private readonly connection: IORedis;
  private worker: Worker | null = null;
  private readonly token: string;

  constructor(
    queueName: string,
    connection: IORedis,
    queue: JobQueue,
    options: BaseJobWorkerOptions,
  ) {
    super(queue, options);
    this.queueName = queueName;
    this.connection = connection;
    this.token = `worker-${String(now())}-${Math.random().toString(BASE_36).slice(2)}`;
  }

  // ── Lifecycle hooks ───────────────────────────────────────────────

  protected override onStart(): void {
    // Pass connection config (not the instance) so BullMQ fully owns
    // the internal connection lifecycle. See BullMQJobQueue constructor.
    // Forwards auth, TLS, db, and sentinel options alongside host/port.
    const { host, port, password, username, db, tls, keyPrefix, sentinels, natMap } =
      this.connection.options;
    const connOpts = {
      host,
      port,
      ...(password !== undefined && { password }),
      ...(username !== undefined && { username }),
      ...(db !== undefined && { db }),
      ...(tls !== undefined && { tls }),
      ...(keyPrefix !== undefined && { keyPrefix }),
      ...(sentinels !== undefined && { sentinels }),
      ...(natMap !== undefined && { natMap }),
    };
    this.worker = new Worker(this.queueName, undefined, {
      connection: connOpts,
      autorun: false,
    });
    // Prevent unhandled EventEmitter errors from BullMQ's internal connections
    // (main + blocking) during teardown.
    this.worker.on("error", (err: Error) => {
      this.logger.warn("worker.bullmq-connection-error", {
        error: extractErrorMessage(err),
      });
    });
  }

  protected override async onStop(): Promise<void> {
    if (this.worker !== null) {
      // Wait for connections to finish initializing before closing to avoid
      // unhandled rejections from interrupted init commands.
      await Promise.allSettled([this.worker.waitUntilReady()]);
      await this.worker.close();
      this.worker = null;
    }
  }

  // ── Adapter-specific poll ─────────────────────────────────────────

  protected override async poll(): Promise<void> {
    if (this.shouldSkipPoll() || this.worker === null) return;

    let bullmqJob: BullMQJob | undefined;
    try {
      bullmqJob = (await this.worker.getNextJob(this.token)) as BullMQJob | undefined;
      this.handlePollSuccess();
    } catch (err) {
      this.handlePollFailure(err);
      return;
    }

    if (bullmqJob === undefined) return;
    void this.processBullMQJob(bullmqJob);
  }

  // ── BullMQ-specific processing ────────────────────────────────────

  private async processBullMQJob(bullmqJob: BullMQJob): Promise<void> {
    const jobId = bullmqJob.id as JobId;

    // Update status to running
    const currentData = bullmqJob.data as StoredJobData;
    const runningData: StoredJobData = {
      ...currentData,
      status: "running",
      startedAt: this.clock(),
      lastHeartbeatAt: this.clock(),
    };

    try {
      await bullmqJob.updateData(runningData);
    } catch (err) {
      this.logger.error("worker.update-data-failed", {
        jobId,
        error: extractErrorMessage(err),
      });
      try {
        await this.queue.fail(jobId, `Failed to update job data: ${extractErrorMessage(err)}`);
      } catch (failErr) {
        this.logger.error("worker.fail-delegation-error", {
          jobId,
          error: extractErrorMessage(failErr),
        });
      }
      return;
    }

    const job: JobDefinition = fromStoredData(jobId, runningData);

    const heartbeatHandle: HeartbeatHandle = {
      heartbeat: async () => {
        const data = bullmqJob.data as StoredJobData;
        try {
          await bullmqJob.updateData({ ...data, lastHeartbeatAt: this.clock() });
        } catch (err) {
          const msg = `Heartbeat failed for job "${jobId}": ${extractErrorMessage(err)}`;
          this.logger.error("worker.heartbeat-update-failed", {
            jobId,
            error: extractErrorMessage(err),
          });
          throw new Error(msg, { cause: err });
        }
      },
    };

    await this.processJob(job, heartbeatHandle);
  }
}
