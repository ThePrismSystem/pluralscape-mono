import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { QueueCorruptionError } from "../../../errors.js";
import { rowToJob } from "../row-mapper.js";

import type { JobRow } from "@pluralscape/db/sqlite";
import type { JobId, JobPayload, JobType } from "@pluralscape/types";

const BASE_CREATED_AT = 1_700_000_000_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function baseRow(overrides: Partial<JobRow>): JobRow {
  return {
    id: brandId<JobId>("job_x"),
    systemId: null,
    type: "email-send",
    payload: {
      accountId: "acc_x",
      template: "password-changed",
      vars: {},
      recipientOverride: null,
    },
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    nextRetryAt: null,
    error: null,
    result: null,
    createdAt: BASE_CREATED_AT,
    startedAt: null,
    completedAt: null,
    idempotencyKey: null,
    lastHeartbeatAt: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    scheduledFor: null,
    priority: 0,
    ...overrides,
  } satisfies JobRow;
}

describe("rowToJob", () => {
  it("narrows payload based on type for email-send", () => {
    const job = rowToJob(baseRow({}));
    if (job.type !== "email-send") throw new Error("wrong narrowing");
    expect(job.payload.template).toBe("password-changed");
    expect(job.payload.recipientOverride).toBeNull();
  });

  it("passes through a well-formed sync-compaction row", () => {
    const job = rowToJob(
      baseRow({
        type: "sync-compaction",
        payload: {
          documentId: "doc_abc",
          systemId: "sys_abc",
        },
      }),
    );
    if (job.type !== "sync-compaction") throw new Error("wrong narrowing");
    expect(job.payload.documentId).toBe("doc_abc");
  });

  it("throws QueueCorruptionError when type/payload disagree", () => {
    // `JobPayload` is the structural union of every payload shape — assigning
    // `{ wrong: "shape" }` to it goes through a single-step `as JobPayload`
    // cast (no `as unknown as`) because the literal is already an object that
    // cannot satisfy any variant. The row-mapper's zod check rejects it.
    const corruptPayload = { wrong: "shape" } as JobPayload;
    const bad = baseRow({
      type: "email-send",
      payload: corruptPayload,
    });
    expect(() => rowToJob(bad)).toThrow(QueueCorruptionError);
  });

  it("throws QueueCorruptionError for an unknown job type", () => {
    // Same pattern — exercising the "database row advertises a type we don't
    // recognise" path that fires when a new job type is dropped mid-deploy.
    const unknownType = "not-a-real-type" as JobType;
    const emptyPayload = {} as JobPayload;
    const bad = baseRow({ type: unknownType, payload: emptyPayload });
    expect(() => rowToJob(bad)).toThrow(QueueCorruptionError);
  });
});
