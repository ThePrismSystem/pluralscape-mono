import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EncryptedString } from "../encryption.js";
import type { GroupId, MemberId, PKBridgeConfigId, SwitchId, SystemId } from "../ids.js";
import type {
  PKBridgeConfig,
  PKEntityMapping,
  PKGroupMapping,
  PKMemberMapping,
  PKSwitchMapping,
  PKSyncableEntityType,
  PKSyncDirection,
  PKSyncError,
  PKSyncErrorCode,
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

describe("PKSyncableEntityType", () => {
  it("accepts valid entity types", () => {
    assertType<PKSyncableEntityType>("member");
    assertType<PKSyncableEntityType>("group");
    assertType<PKSyncableEntityType>("switch");
  });

  it("rejects invalid entity types", () => {
    // @ts-expect-error invalid syncable entity type
    assertType<PKSyncableEntityType>("note");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: PKSyncableEntityType): string {
      switch (type) {
        case "member":
        case "group":
        case "switch":
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

describe("PKSyncErrorCode", () => {
  it("accepts valid error codes", () => {
    assertType<PKSyncErrorCode>("rate-limited");
    assertType<PKSyncErrorCode>("token-invalid");
    assertType<PKSyncErrorCode>("unknown");
  });

  it("rejects invalid error codes", () => {
    // @ts-expect-error invalid error code
    assertType<PKSyncErrorCode>("timeout");
  });

  it("is exhaustive in a switch", () => {
    function handleCode(code: PKSyncErrorCode): string {
      switch (code) {
        case "rate-limited":
        case "token-invalid":
        case "token-expired":
        case "entity-not-found":
        case "conflict":
        case "network-error":
        case "pk-api-error":
        case "deserialization-error":
        case "unknown":
          return code;
        default: {
          const _exhaustive: never = code;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleCode).toBeFunction();
  });
});

describe("PKBridgeConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<PKBridgeConfig["id"]>().toEqualTypeOf<PKBridgeConfigId>();
    expectTypeOf<PKBridgeConfig["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<PKBridgeConfig["pkToken"]>().toEqualTypeOf<EncryptedString>();
    expectTypeOf<PKBridgeConfig["syncDirection"]>().toEqualTypeOf<PKSyncDirection>();
    expectTypeOf<PKBridgeConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<PKBridgeConfig["lastSyncAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<PKBridgeConfig["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<PKBridgeConfig["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<PKBridgeConfig["version"]>().toEqualTypeOf<number>();
  });
});

describe("PKEntityMapping", () => {
  it("is a discriminated union on psEntityType", () => {
    function handleMapping(mapping: PKEntityMapping): string {
      switch (mapping.psEntityType) {
        case "member":
          expectTypeOf(mapping).toEqualTypeOf<PKMemberMapping>();
          expectTypeOf(mapping.psEntityId).toEqualTypeOf<MemberId>();
          return "member";
        case "group":
          expectTypeOf(mapping).toEqualTypeOf<PKGroupMapping>();
          expectTypeOf(mapping.psEntityId).toEqualTypeOf<GroupId>();
          return "group";
        case "switch":
          expectTypeOf(mapping).toEqualTypeOf<PKSwitchMapping>();
          expectTypeOf(mapping.psEntityId).toEqualTypeOf<SwitchId>();
          return "switch";
        default: {
          const _exhaustive: never = mapping;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleMapping).toBeFunction();
  });

  it("has common fields across all variants", () => {
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
    expectTypeOf<PKSyncError["code"]>().toEqualTypeOf<PKSyncErrorCode>();
    expectTypeOf<PKSyncError["message"]>().toBeString();
    expectTypeOf<PKSyncError["entityId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<PKSyncError["occurredAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<PKSyncError["retryable"]>().toEqualTypeOf<boolean>();
  });
});
