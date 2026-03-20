import type { JobQueue } from "../job-queue.js";
import type { Logger } from "@pluralscape/types";

const DEFAULT_INTERVAL_MS = 30_000;
const STALL_ERROR_MESSAGE = "Job stalled: heartbeat timeout exceeded";

export interface StalledSweeperOptions {
  intervalMs?: number;
  logger?: Logger;
  /** Called after each sweep with the number of stalled jobs found. */
  onSweep?: (count: number) => void;
}

/**
 * Periodically calls findStalledJobs() and fails any jobs whose heartbeat
 * has timed out, allowing them to be retried or dead-lettered per their policy.
 */
export class StalledJobSweeper {
  private readonly queue: JobQueue;
  private readonly intervalMs: number;
  private readonly logger: Logger | undefined;
  private readonly onSweep: ((count: number) => void) | undefined;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(queue: JobQueue, options?: StalledSweeperOptions) {
    this.queue = queue;
    this.intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.logger = options?.logger;
    this.onSweep = options?.onSweep;
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const stalled = await this.queue.findStalledJobs();
      if (stalled.length > 0) {
        this.logger?.warn("stalled-sweeper.found", { count: stalled.length });
        for (const job of stalled) {
          try {
            await this.queue.fail(job.id, STALL_ERROR_MESSAGE);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger?.error("stalled-sweeper.fail-error", { jobId: job.id, error: message });
          }
        }
      }
      this.onSweep?.(stalled.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error("stalled-sweeper.sweep-error", { error: message });
    } finally {
      this.sweeping = false;
    }
  }
}
