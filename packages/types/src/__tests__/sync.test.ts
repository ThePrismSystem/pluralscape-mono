import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  EntityType,
  SyncConflictId,
  SyncDocumentId,
  SyncQueueItemId,
  SystemId,
} from "../ids.js";
import type {
  SyncConflict,
  SyncDocument,
  SyncIndicator,
  SyncIndicatorStatus,
  SyncOperation,
  SyncQueueItem,
  SyncResolution,
  SyncState,
} from "../sync.js";
import type { UnixMillis } from "../timestamps.js";

describe("SyncOperation", () => {
  it("is exhaustive in a switch statement", () => {
    function handle(op: SyncOperation): string {
      switch (op) {
        case "create":
        case "update":
        case "delete":
          return op;
        default: {
          const _exhaustive: never = op;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handle).toBeFunction();
  });
});

describe("SyncResolution", () => {
  it("is exhaustive in a switch statement", () => {
    function handle(res: SyncResolution): string {
      switch (res) {
        case "local":
        case "remote":
        case "merged":
          return res;
        default: {
          const _exhaustive: never = res;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handle).toBeFunction();
  });
});

describe("SyncIndicatorStatus", () => {
  it("is exhaustive in a switch statement", () => {
    function handle(s: SyncIndicatorStatus): string {
      switch (s) {
        case "synced":
        case "syncing":
        case "offline":
        case "error":
          return s;
        default: {
          const _exhaustive: never = s;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handle).toBeFunction();
  });
});

describe("SyncDocument", () => {
  it("has expected fields", () => {
    expectTypeOf<SyncDocument["id"]>().toEqualTypeOf<SyncDocumentId>();
    expectTypeOf<SyncDocument["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SyncDocument["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<SyncDocument["entityId"]>().toEqualTypeOf<string>();
    expectTypeOf<SyncDocument["automergeHeads"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<SyncDocument["lastSyncedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SyncDocument["version"]>().toEqualTypeOf<number>();
  });
});

describe("SyncQueueItem", () => {
  it("has expected fields", () => {
    expectTypeOf<SyncQueueItem["id"]>().toEqualTypeOf<SyncQueueItemId>();
    expectTypeOf<SyncQueueItem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SyncQueueItem["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<SyncQueueItem["entityId"]>().toEqualTypeOf<string>();
    expectTypeOf<SyncQueueItem["operation"]>().toEqualTypeOf<SyncOperation>();
    expectTypeOf<SyncQueueItem["changeData"]>().toEqualTypeOf<Uint8Array>();
    expectTypeOf<SyncQueueItem["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SyncQueueItem["syncedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("SyncConflict", () => {
  it("has expected fields", () => {
    expectTypeOf<SyncConflict["id"]>().toEqualTypeOf<SyncConflictId>();
    expectTypeOf<SyncConflict["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SyncConflict["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<SyncConflict["entityId"]>().toEqualTypeOf<string>();
    expectTypeOf<SyncConflict["localVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncConflict["remoteVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncConflict["resolution"]>().toEqualTypeOf<SyncResolution>();
    expectTypeOf<SyncConflict["resolvedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<SyncConflict["details"]>().toEqualTypeOf<string | null>();
  });
});

describe("SyncState", () => {
  it("has no id field (runtime state, not persisted)", () => {
    expectTypeOf<SyncState>().not.toHaveProperty("id");
  });

  it("has expected fields", () => {
    expectTypeOf<SyncState["lastSyncedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<SyncState["pendingChanges"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncState["syncInProgress"]>().toEqualTypeOf<boolean>();
  });
});

describe("SyncIndicator", () => {
  it("has expected fields", () => {
    expectTypeOf<SyncIndicator["status"]>().toEqualTypeOf<SyncIndicatorStatus>();
    expectTypeOf<SyncIndicator["lastSyncedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<SyncIndicator["pendingCount"]>().toEqualTypeOf<number>();
  });
});

describe("branded ID non-interchangeability", () => {
  it("SyncDocumentId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<SyncDocumentId>("sdoc_test");
  });

  it("SyncQueueItemId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<SyncQueueItemId>("sqi_test");
  });

  it("SyncConflictId is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded type
    assertType<SyncConflictId>("scon_test");
  });

  it("sync IDs are not interchangeable", () => {
    // @ts-expect-error different branded types
    expectTypeOf<SyncDocumentId>().toEqualTypeOf<SyncQueueItemId>();
  });
});
