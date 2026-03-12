import { assertType, describe, expectTypeOf, it } from "vitest";

import type { JobId, SystemId } from "../ids.js";
import type { JobDefinition, JobResult, JobStatus, JobType } from "../jobs.js";
import type { UnixMillis } from "../timestamps.js";

describe("JobId", () => {
  it("extends string", () => {
    expectTypeOf<JobId>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to JobId
    assertType<JobId>("job_123");
  });
});

describe("JobType", () => {
  it("accepts valid types", () => {
    assertType<JobType>("sync-push");
    assertType<JobType>("blob-upload");
    assertType<JobType>("webhook-deliver");
    assertType<JobType>("analytics-compute");
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid job type
    assertType<JobType>("email-send");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: JobType): string {
      switch (type) {
        case "sync-push":
        case "sync-pull":
        case "blob-upload":
        case "blob-cleanup":
        case "export-generate":
        case "import-process":
        case "webhook-deliver":
        case "notification-send":
        case "analytics-compute":
        case "account-purge":
        case "bucket-key-rotation":
        case "report-generate":
        case "sync-queue-cleanup":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });
});

describe("JobStatus", () => {
  it("accepts valid statuses", () => {
    assertType<JobStatus>("pending");
    assertType<JobStatus>("running");
    assertType<JobStatus>("completed");
    assertType<JobStatus>("failed");
    assertType<JobStatus>("cancelled");
    assertType<JobStatus>("dead-letter");
  });

  it("rejects invalid statuses", () => {
    // @ts-expect-error invalid status
    assertType<JobStatus>("queued");
  });

  it("is exhaustive in a switch", () => {
    function handleStatus(status: JobStatus): string {
      switch (status) {
        case "pending":
        case "running":
        case "completed":
        case "failed":
        case "cancelled":
        case "dead-letter":
          return status;
        default: {
          const _exhaustive: never = status;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleStatus).toBeFunction();
  });
});

describe("RetryPolicy", () => {
  it("has correct field types", () => {
    const policy: import("../jobs.js").RetryPolicy = {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
    };
    expectTypeOf(policy.maxRetries).toEqualTypeOf<number>();
    expectTypeOf(policy.backoffMs).toEqualTypeOf<number>();
    expectTypeOf(policy.backoffMultiplier).toEqualTypeOf<number>();
    expectTypeOf(policy.maxBackoffMs).toEqualTypeOf<number>();
  });
});

describe("JobResult", () => {
  it("has correct field types", () => {
    expectTypeOf<JobResult["success"]>().toEqualTypeOf<boolean>();
    expectTypeOf<JobResult["message"]>().toEqualTypeOf<string | null>();
    expectTypeOf<JobResult["completedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("JobDefinition", () => {
  it("has correct field types", () => {
    expectTypeOf<JobDefinition["id"]>().toEqualTypeOf<JobId>();
    expectTypeOf<JobDefinition["systemId"]>().toEqualTypeOf<SystemId | null>();
    expectTypeOf<JobDefinition["type"]>().toEqualTypeOf<JobType>();
    expectTypeOf<JobDefinition["status"]>().toEqualTypeOf<JobStatus>();
    expectTypeOf<JobDefinition["payload"]>().toEqualTypeOf<Readonly<Record<string, unknown>>>();
    expectTypeOf<JobDefinition["attempts"]>().toEqualTypeOf<number>();
    expectTypeOf<JobDefinition["maxAttempts"]>().toEqualTypeOf<number>();
    expectTypeOf<JobDefinition["nextRetryAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["error"]>().toEqualTypeOf<string | null>();
    expectTypeOf<JobDefinition["result"]>().toEqualTypeOf<JobResult | null>();
    expectTypeOf<JobDefinition["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<JobDefinition["startedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["completedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["idempotencyKey"]>().toEqualTypeOf<string | null>();
    expectTypeOf<JobDefinition["lastHeartbeatAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["timeoutMs"]>().toEqualTypeOf<number>();
    expectTypeOf<JobDefinition["scheduledFor"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["priority"]>().toEqualTypeOf<number>();
  });
});
