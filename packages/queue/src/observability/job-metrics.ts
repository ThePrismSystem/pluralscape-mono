import type { JobType } from "@pluralscape/types";

export interface JobTypeMetrics {
  enqueued: number;
  completed: number;
  failed: number;
  deadLettered: number;
  /** Sum of all completion durations in ms — divide by completed to get the average. */
  totalDurationMs: number;
}

export interface AggregateMetrics {
  totalEnqueued: number;
  totalCompleted: number;
  totalFailed: number;
  totalDeadLettered: number;
  byType: Partial<Record<JobType, JobTypeMetrics>>;
}

export interface JobMetrics {
  recordEnqueue(type: JobType): void;
  recordComplete(type: JobType, durationMs: number): void;
  recordFailure(type: JobType): void;
  recordDeadLetter(type: JobType): void;
  getTypeMetrics(type: JobType): JobTypeMetrics;
  getAggregateMetrics(): AggregateMetrics;
}

const ZERO_TYPE_METRICS: Readonly<JobTypeMetrics> = {
  enqueued: 0,
  completed: 0,
  failed: 0,
  deadLettered: 0,
  totalDurationMs: 0,
};

function freshTypeMetrics(): JobTypeMetrics {
  return { ...ZERO_TYPE_METRICS };
}

export class InMemoryJobMetrics implements JobMetrics {
  private readonly byType = new Map<JobType, JobTypeMetrics>();

  private typeMetrics(type: JobType): JobTypeMetrics {
    let m = this.byType.get(type);
    if (m === undefined) {
      m = freshTypeMetrics();
      this.byType.set(type, m);
    }
    return m;
  }

  recordEnqueue(type: JobType): void {
    this.typeMetrics(type).enqueued++;
  }

  recordComplete(type: JobType, durationMs: number): void {
    const m = this.typeMetrics(type);
    m.completed++;
    m.totalDurationMs += durationMs;
  }

  recordFailure(type: JobType): void {
    this.typeMetrics(type).failed++;
  }

  recordDeadLetter(type: JobType): void {
    this.typeMetrics(type).deadLettered++;
  }

  getTypeMetrics(type: JobType): JobTypeMetrics {
    return { ...(this.byType.get(type) ?? ZERO_TYPE_METRICS) };
  }

  getAggregateMetrics(): AggregateMetrics {
    let totalEnqueued = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalDeadLettered = 0;
    const byType: Partial<Record<JobType, JobTypeMetrics>> = {};

    for (const [type, metrics] of this.byType) {
      totalEnqueued += metrics.enqueued;
      totalCompleted += metrics.completed;
      totalFailed += metrics.failed;
      totalDeadLettered += metrics.deadLettered;
      byType[type] = { ...metrics };
    }

    return { totalEnqueued, totalCompleted, totalFailed, totalDeadLettered, byType };
  }
}
