# @pluralscape/queue

Backend-agnostic job queue with BullMQ and SQLite adapters for reliable async processing.

## Overview

`@pluralscape/queue` provides a shared interface for durable, retryable background jobs across
Pluralscape's two deployment tiers. The core `JobQueue` and `JobWorker` interfaces define a
single contract that both adapters implement, keeping application code free of backend-specific
concerns.

The BullMQ adapter (backed by Valkey) serves the hosted and full self-hosted tiers. It provides
priority queues, delayed jobs, repeatable schedules, and rate limiting — the same Valkey instance
already required for real-time pub/sub (see ADR 007). The SQLite adapter runs in-process against
the existing local database, polling a job table on a configurable interval. It targets the
minimal self-hosted tier where no external services are available; throughput is lower but all
retry, backoff, DLQ, and idempotency semantics are identical.

Both adapters enforce idempotency via per-job keys, support exponential backoff with configurable
retry policies, route exhausted jobs to a dead-letter queue (DLQ), and expose health and metrics
through the observability layer. Job payloads carry only IDs and encrypted references — never
plaintext user data. See [ADR 010](../../docs/adr/010-background-jobs.md) for the full decision
record.

## Key Exports

### Root (`@pluralscape/queue`)

**Interfaces**

- `JobQueue` — enqueue, dequeue, acknowledge, bury, and query jobs
- `JobWorker` — register handlers and manage the worker lifecycle
- `JobHandler`, `JobHandlerContext` — per-job-type processing contract
- `JobEventHooks` — lifecycle callbacks (enqueue, start, complete, fail, bury)
- `HeartbeatHandle` — token returned by long-running jobs to emit liveness signals

**Base class**

- `BaseJobWorker` — shared worker logic (handler registry, shutdown, heartbeat dispatch)

**Errors**

- `DuplicateHandlerError` — handler registered twice for the same job type
- `IdempotencyConflictError` — job with this idempotency key already completed or in-flight
- `InvalidJobTransitionError` — illegal state transition (e.g., completing a buried job)
- `JobNotFoundError` — job ID not found when acknowledging or burying
- `NoHandlersRegisteredError` — worker started with no handlers
- `WorkerAlreadyRunningError` — `start()` called on an already-running worker

**Types**

- `JobEnqueueParams`, `JobFilter`, `IdempotencyCheckResult`

**Constants (exported from root)**

- `DEFAULT_TIMEOUT_MS` (30 000 ms)
- `DEFAULT_POLL_INTERVAL_MS` (100 ms)
- `DEFAULT_SHUTDOWN_TIMEOUT_MS` (5 000 ms)
- `AUDIT_LOG_CLEANUP_CRON` — `"0 3 * * *"` (03:00 UTC)
- `WEBHOOK_DELIVERY_CLEANUP_CRON` — `"30 3 * * *"` (03:30 UTC)

### Sub-entry points

| Entry point      | Exports                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bullmq`        | `BullMQJobQueue`, `BullMQJobWorker`, `createValkeyConnection`, `ValkeyConnectionConfig`, `fromStoredData`, `StoredJobData`                                                                                                                    |
| `/sqlite`        | `SqliteJobQueue`, `SqliteJobWorker`, `rowToJob`                                                                                                                                                                                               |
| `/policies`      | `calculateBackoff`, `DEFAULT_RETRY_POLICY`, `DEFAULT_RETRY_POLICIES`, `applyDefaultPolicies`                                                                                                                                                  |
| `/dlq`           | `DLQManager`, `DLQFilter`                                                                                                                                                                                                                     |
| `/observability` | `ObservableJobQueue`, `ObservableJobWorker`, `QueueHealthService`, `QueueHealthSummary`, `InMemoryJobMetrics`, `AggregateMetrics`, `JobMetrics`, `JobTypeMetrics`, `StalledJobSweeper`, `StalledSweeperOptions`, `checkAlerts`, `AlertConfig` |
| `/testing`       | `InMemoryJobQueue`, `InMemoryJobWorker`, `runJobQueueContract`, `runJobWorkerContract`, `makeJobParams`, `testSystemId`, `delay`, `dequeueOrFail`                                                                                             |

## Usage

```ts
import { BullMQJobQueue, BullMQJobWorker, createValkeyConnection } from "@pluralscape/queue/bullmq";
import { ObservableJobQueue, ObservableJobWorker } from "@pluralscape/queue/observability";
import { DEFAULT_RETRY_POLICIES } from "@pluralscape/queue/policies";

const connection = createValkeyConnection({ host: "localhost", port: 6379 });

const queue = new ObservableJobQueue(
  new BullMQJobQueue({ connection, queueName: "default" }),
  metrics,
);

const worker = new ObservableJobWorker(
  new BullMQJobWorker({ connection, queueName: "default" }),
  metrics,
);

worker.register("email.send", async (job, ctx) => {
  await sendEmail(job.payload.emailId);
  ctx.heartbeat(); // for long-running jobs
});

await worker.start();

await queue.enqueue({
  type: "email.send",
  payload: { emailId: "abc123" },
  idempotencyKey: "email-send-abc123",
  retryPolicy: DEFAULT_RETRY_POLICIES["email.send"],
});
```

For the SQLite backend, replace `BullMQJobQueue`/`BullMQJobWorker` with `SqliteJobQueue`/`SqliteJobWorker` from `@pluralscape/queue/sqlite`. The handler registration and lifecycle API is identical.

For tests, use `InMemoryJobQueue` and `InMemoryJobWorker` from `@pluralscape/queue/testing`, or run adapter contract suites against a custom implementation with `runJobQueueContract` and `runJobWorkerContract`.

## Dependencies

| Package              | Role                                                   |
| -------------------- | ------------------------------------------------------ |
| `bullmq`             | BullMQ queue and worker (hosted/full self-hosted tier) |
| `ioredis`            | Valkey/Redis client used by BullMQ                     |
| `drizzle-orm`        | SQLite job table queries                               |
| `@pluralscape/db`    | Shared database instance and schema                    |
| `@pluralscape/types` | Shared domain types                                    |

## Testing

Unit tests (no external services):

```bash
pnpm vitest run --project queue
```

Integration tests (requires a running Valkey instance):

```bash
pnpm vitest run --project queue-integration
```

Both adapters are covered by the shared contract suites in `/testing`. Integration tests exercise
the BullMQ adapter against a real Valkey connection, DLQ promotion, stalled-job sweeping, and
health checks.
