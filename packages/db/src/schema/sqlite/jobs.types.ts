/**
 * Strongly-typed payload for the `jobs` table.
 *
 * `jobs.payload` is a JSON column whose shape depends on `jobs.type`. The
 * discriminator lives on the sibling `type` column (not embedded inside the
 * payload), so `JobPayload` here is a union of payload shapes keyed by
 * `JobType` via `JobPayloadMap`.
 *
 * When adding a new job type:
 * 1. Add the type literal to `JobType` in `@pluralscape/types` and to
 *    `JOB_TYPES` in `packages/db/src/helpers/enums.ts`.
 * 2. Add a concrete payload shape to `JobPayloadMap` (prefer a named
 *    interface over `Record<string, unknown>`).
 * 3. Producers (`queue.enqueue`) automatically get the stricter inference
 *    via `JobEnqueueParams<T>` in `@pluralscape/queue`.
 */

import type { JobPayloadMap, JobType } from "@pluralscape/types";

/**
 * Union of all valid `jobs.payload` shapes.
 *
 * Index-access of `JobPayloadMap` over the full `JobType` union yields the
 * distributive union of payload shapes. The sibling `jobs.type` column acts
 * as the runtime discriminator — workers use it to narrow `payload` back to
 * the concrete shape for their job type (see `push-notification-worker.ts`
 * and `email-worker.ts`).
 */
export type JobPayload = JobPayloadMap[JobType];
