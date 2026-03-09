import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  PKBridgeConfig,
  PKEntityMapping,
  PKSyncDirection,
  PKSyncError,
  PKSyncState,
  PKSyncStatus,
} from "../pk-bridge.js";
import type { UnixMillis } from "../timestamps.js";

describe("PKSyncDirection", () => {
  it("accepts valid directions", () => {
    assertType<PKSyncDirection>("ps-to-pk");
    assertType<PKSyncDirection>("pk-to-ps");
    assertType<PKSyncDirection>("bidirectional");
  });

  it("rejects invalid directions", () => {
    // @ts-expect-error invalid sync direction
    assertType<PKSyncDirection>("one-way");
  });

  it("is exhaustive in a switch", () => {
    function handleDirection(dir: PKSyncDirection): string {
      switch (dir) {
        case "ps-to-pk":
        case "pk-to-ps":
        case "bidirectional":
          return dir;
        default: {
          const _exhaustive: never = dir;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleDirection).toBeFunction();
  });
});

describe("PKSyncStatus", () => {
  it("accepts valid statuses", () => {
    assertType<PKSyncStatus>("idle");
    assertType<PKSyncStatus>("syncing");
    assertType<PKSyncStatus>("error");
    assertType<PKSyncStatus>("paused");
  });

  it("rejects invalid statuses", () => {
    // @ts-expect-error invalid sync status
    assertType<PKSyncStatus>("running");
  });

  it("is exhaustive in a switch", () => {
    function handleStatus(status: PKSyncStatus): string {
      switch (status) {
        case "idle":
        case "syncing":
        case "error":
        case "paused":
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

describe("PKBridgeConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<PKBridgeConfig["systemId"]>().toBeString();
    expectTypeOf<PKBridgeConfig["pkToken"]>().toBeString();
    expectTypeOf<PKBridgeConfig["syncDirection"]>().toEqualTypeOf<PKSyncDirection>();
    expectTypeOf<PKBridgeConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PKBridgeConfig["lastSyncAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<PKBridgeConfig["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<PKBridgeConfig["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("PKEntityMapping", () => {
  it("has correct field types", () => {
    expectTypeOf<PKEntityMapping["psEntityId"]>().toBeString();
    expectTypeOf<PKEntityMapping["psEntityType"]>().toEqualTypeOf<"member" | "group">();
    expectTypeOf<PKEntityMapping["pkEntityId"]>().toBeString();
    expectTypeOf<PKEntityMapping["lastSyncedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("PKSyncState", () => {
  it("has correct field types", () => {
    expectTypeOf<PKSyncState["status"]>().toEqualTypeOf<PKSyncStatus>();
    expectTypeOf<PKSyncState["lastSuccessAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<PKSyncState["lastErrorAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<PKSyncState["pendingChanges"]>().toEqualTypeOf<number>();
    expectTypeOf<PKSyncState["mappings"]>().toEqualTypeOf<readonly PKEntityMapping[]>();
  });
});

describe("PKSyncError", () => {
  it("has correct field types", () => {
    expectTypeOf<PKSyncError["code"]>().toBeString();
    expectTypeOf<PKSyncError["message"]>().toBeString();
    expectTypeOf<PKSyncError["entityId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKSyncError["occurredAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<PKSyncError["retryable"]>().toEqualTypeOf<boolean>();
  });
});
