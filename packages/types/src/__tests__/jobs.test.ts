import { assertType, describe, expectTypeOf, it } from "vitest";

import type { JobDefinition, JobId, JobResult, JobStatus, JobType, RetryPolicy } from "../jobs.js";
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
  });

  it("rejects invalid statuses", () => {
    // @ts-expect-error invalid status
    assertType<JobStatus>("queued");
  });
});

describe("RetryPolicy", () => {
  it("has correct field types", () => {
    expectTypeOf<RetryPolicy["maxRetries"]>().toEqualTypeOf<number>();
    expectTypeOf<RetryPolicy["backoffMs"]>().toEqualTypeOf<number>();
    expectTypeOf<RetryPolicy["backoffMultiplier"]>().toEqualTypeOf<number>();
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
    expectTypeOf<JobDefinition["type"]>().toEqualTypeOf<JobType>();
    expectTypeOf<JobDefinition["status"]>().toEqualTypeOf<JobStatus>();
    expectTypeOf<JobDefinition["payload"]>().toEqualTypeOf<Readonly<Record<string, unknown>>>();
    expectTypeOf<JobDefinition["retryPolicy"]>().toEqualTypeOf<RetryPolicy>();
    expectTypeOf<JobDefinition["attempts"]>().toEqualTypeOf<number>();
    expectTypeOf<JobDefinition["result"]>().toEqualTypeOf<JobResult | null>();
    expectTypeOf<JobDefinition["scheduledAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<JobDefinition["startedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<JobDefinition["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});
