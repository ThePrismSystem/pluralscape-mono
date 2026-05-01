/**
 * Pure helper functions used by {@link BullMQJobQueue}. Extracted to keep
 * the main class file under the area LOC ceiling. Nothing here depends on
 * `this`; everything is testable as free functions.
 */
import { brandId } from "@pluralscape/types";

import { QueueCorruptionError } from "../../errors.js";
import { SCAN_COUNT } from "../../queue.constants.js";

import { StoredJobDataSchema, type StoredJobData } from "./job-mapper.js";

import type { JobId, JobStatus } from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";
import type { RedisOptions } from "ioredis";
import type { z } from "zod";

/** BullMQ-side state names, mapped from our {@link JobStatus} discriminated union. */
export type BullMQJobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "prioritized";

/**
 * Render a Zod error as a compact, operator-readable summary: one
 * `path: message` pair per issue, joined by "; ". Used as the `details`
 * string passed to {@link QueueCorruptionError} so the top-level message
 * surfaces the failing field without requiring callers to chase `cause`.
 */
export function formatZodIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

/** Brand a BullMQ job's id. Throws if missing — BullMQ assigns ids on add. */
export function jobIdOf(job: BullMQJob): JobId {
  const id = job.id;
  if (id === undefined) throw new Error("BullMQ job missing id");
  return brandId<JobId>(id);
}

/**
 * Validate a BullMQ job's `data` field against {@link StoredJobDataSchema} and
 * return the parsed shape. Throws {@link QueueCorruptionError} on failure so
 * callers surface a typed error rather than a raw ZodError leaking across the
 * queue API boundary.
 *
 * Use this at every point where we deserialize `job.data` — silent casts let
 * partial writes, schema drift, or manual Redis edits produce malformed
 * JobDefinitions downstream, which violates the fail-closed contract.
 */
export function parseJobDataOrThrow(job: BullMQJob): StoredJobData {
  const result = StoredJobDataSchema.safeParse(job.data);
  if (!result.success) {
    throw new QueueCorruptionError(jobIdOf(job), formatZodIssues(result.error), {
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Translate our public {@link JobStatus} to the BullMQ states `Queue.getJobs`
 * understands. `cancelled` returns an empty list because cancelled jobs live
 * in our own Redis hash, not in BullMQ.
 */
export function mapStatusToBullMQStates(status?: JobStatus): BullMQJobState[] {
  if (status === undefined) {
    return ["waiting", "active", "completed", "failed", "delayed", "prioritized"];
  }
  switch (status) {
    case "pending":
      return ["waiting", "delayed", "prioritized"];
    case "running":
      return ["active"];
    case "completed":
      return ["completed"];
    case "dead-letter":
      return ["failed"];
    case "cancelled":
      return [];
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Iterate Redis keys matching `pattern` via SCAN to avoid blocking the server. */
export async function scanRedisKeys(redis: IORedis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_COUNT);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

/**
 * Extract the connection-config subset that BullMQ needs from a live ioredis
 * instance. We pass config (not the live client) so BullMQ creates and fully
 * owns its internal connections — preventing cross-ownership of the user's
 * client and the queue's pubsub/blocking connections.
 */
export function extractRedisOptions(connection: IORedis): RedisOptions {
  const { host, port, password, username, db, tls, keyPrefix, sentinels, natMap } =
    connection.options;
  return {
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
}
