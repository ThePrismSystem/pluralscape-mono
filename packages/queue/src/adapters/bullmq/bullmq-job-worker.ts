import { now } from "@pluralscape/types/runtime";
import { Worker } from "bullmq";

import { BaseJobWorker } from "../base-job-worker.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { HeartbeatHandle } from "../../heartbeat.js";
import type { JobQueue } from "../../job-queue.js";
import type { BaseJobWorkerOptions } from "../base-job-worker.js";
import type { JobDefinition, JobId } from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";

const BASE_36 = 36;

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
    this.worker = new Worker(this.queueName, undefined, {
      connection: this.connection,
      autorun: false,
    });
  }

  protected override async onStop(): Promise<void> {
    if (this.worker !== null) {
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
    await bullmqJob.updateData(runningData);

    const job: JobDefinition = fromStoredData(jobId, runningData);

    const heartbeatHandle: HeartbeatHandle = {
      heartbeat: async () => {
        const data = bullmqJob.data as StoredJobData;
        await bullmqJob.updateData({ ...data, lastHeartbeatAt: this.clock() });
      },
    };

    await this.processJob(job, heartbeatHandle);
  }
}
