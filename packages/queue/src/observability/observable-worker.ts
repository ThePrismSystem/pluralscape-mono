import type { JobWorker, JobHandler } from "../job-worker.js";
import type { JobLogger } from "./job-logger.js";
import type { JobDefinition, JobType } from "@pluralscape/types";

/**
 * Decorator that wraps a JobWorker to emit structured log lines
 * when handlers are registered, started, stopped, and when jobs are processed.
 */
export class ObservableJobWorker implements JobWorker {
  private readonly inner: JobWorker;
  private readonly logger: JobLogger;

  constructor(inner: JobWorker, logger: JobLogger) {
    this.inner = inner;
    this.logger = logger;
  }

  registerHandler<T extends JobType>(type: T, handler: JobHandler<T>): void {
    const wrapped: JobHandler = async (job: JobDefinition, ctx) => {
      this.logger.info("job.processing", { jobId: job.id, type: job.type });
      try {
        // Safe: jobs dispatched to this handler are already filtered by type
        await handler(job as JobDefinition<T>, ctx);
        this.logger.info("job.handler-succeeded", { jobId: job.id, type: job.type });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error("job.handler-failed", { jobId: job.id, type: job.type, error: message });
        throw err;
      }
    };
    this.inner.registerHandler(type, wrapped);
  }

  start(): Promise<void> {
    this.logger.info("worker.starting");
    return this.inner.start();
  }

  stop(): Promise<void> {
    this.logger.info("worker.stopping");
    return this.inner.stop();
  }

  isRunning(): boolean {
    return this.inner.isRunning();
  }

  registeredTypes(): readonly JobType[] {
    return this.inner.registeredTypes();
  }
}
