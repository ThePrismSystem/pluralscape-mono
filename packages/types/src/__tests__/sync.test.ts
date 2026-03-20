import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SyncDocumentId, SystemId } from "../ids.js";
import type {
  SyncDocument,
  SyncDocType,
  SyncIndicator,
  SyncIndicatorStatus,
  SyncKeyType,
  SyncState,
} from "../sync.js";
import type { UnixMillis } from "../timestamps.js";

describe("SyncDocType", () => {
  it("is exhaustive in a switch statement", () => {
    function handle(t: SyncDocType): string {
      switch (t) {
        case "system-core":
        case "fronting":
        case "chat":
        case "journal":
        case "privacy-config":
        case "bucket":
          return t;
        default: {
          const _exhaustive: never = t;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handle).toBeFunction();
  });

  it("accepts all valid variants", () => {
    assertType<SyncDocType>("system-core");
    assertType<SyncDocType>("fronting");
    assertType<SyncDocType>("chat");
    assertType<SyncDocType>("journal");
    assertType<SyncDocType>("privacy-config");
    assertType<SyncDocType>("bucket");
  });

  it("rejects invalid variants", () => {
    // @ts-expect-error invalid SyncDocType
    assertType<SyncDocType>("member");
    // @ts-expect-error invalid SyncDocType
    assertType<SyncDocType>("unknown");
  });
});

describe("SyncKeyType", () => {
  it("is exhaustive in a switch statement", () => {
    function handle(k: SyncKeyType): string {
      switch (k) {
        case "derived":
        case "bucket":
          return k;
        default: {
          const _exhaustive: never = k;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handle).toBeFunction();
  });

  it("accepts all valid variants", () => {
    assertType<SyncKeyType>("derived");
    assertType<SyncKeyType>("bucket");
  });

  it("rejects invalid variants", () => {
    // @ts-expect-error invalid SyncKeyType
    assertType<SyncKeyType>("symmetric");
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
    expectTypeOf<SyncDocument["documentId"]>().toEqualTypeOf<string>();
    expectTypeOf<SyncDocument["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SyncDocument["docType"]>().toEqualTypeOf<SyncDocType>();
    expectTypeOf<SyncDocument["sizeBytes"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncDocument["snapshotVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncDocument["lastSeq"]>().toEqualTypeOf<number>();
    expectTypeOf<SyncDocument["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SyncDocument["timePeriod"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SyncDocument["keyType"]>().toEqualTypeOf<SyncKeyType>();
    expectTypeOf<SyncDocument["bucketId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SyncDocument["channelId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SyncDocument["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SyncDocument["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has no legacy id field", () => {
    expectTypeOf<SyncDocument>().not.toHaveProperty("id");
  });

  it("has no legacy entityType field", () => {
    expectTypeOf<SyncDocument>().not.toHaveProperty("entityType");
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
});
