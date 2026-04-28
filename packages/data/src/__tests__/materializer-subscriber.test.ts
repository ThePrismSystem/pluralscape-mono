import { createEventBus, type DataLayerEventMap, type EventBus } from "@pluralscape/sync";
import {
  getMaterializer,
  registerMaterializer,
  type MaterializerDb,
} from "@pluralscape/sync/materializer";
import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createMaterializerSubscriber } from "../materializer-subscriber.js";

import type { DocumentSnapshotProvider } from "../crdt-query-bridge.js";
import type { SyncDocumentId, SyncDocumentType } from "@pluralscape/types";

function makeMockMaterializerDb(): MaterializerDb {
  return {
    queryAll: vi.fn(() => []),
    execute: vi.fn(),
    transaction: <T>(fn: () => T): T => fn(),
  };
}

function makeMockEngine(snapshots: Record<string, unknown>): {
  engine: DocumentSnapshotProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn((id: SyncDocumentId) => snapshots[String(id)]);
  return {
    engine: { getDocumentSnapshot: spy },
    spy,
  };
}

function docId(raw: string): SyncDocumentId {
  return brandId<SyncDocumentId>(raw);
}

const TEST_DOC_TYPE = "system-core" as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMaterializerSubscriber", () => {
  test("calls registered materializer on sync:changes-merged", () => {
    const id = docId("system-core_sys_test1");
    const docSnapshot = { members: {} };
    const { engine, spy } = makeMockEngine({ [id]: docSnapshot });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const materializeSpy = vi.fn();
    registerMaterializer({
      documentType: TEST_DOC_TYPE,
      materialize: materializeSpy,
    });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: id,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    expect(spy).toHaveBeenCalledWith(id);
    expect(materializeSpy).toHaveBeenCalledTimes(1);
    expect(materializeSpy).toHaveBeenCalledWith(
      docSnapshot,
      materializerDb,
      eventBus,
      expect.any(Set),
    );

    handle.dispose();
  });

  test("no-ops when getDocumentSnapshot returns undefined (session evicted)", () => {
    const id = docId("system-core_sys_evicted");
    const { engine } = makeMockEngine({});
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: id,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    expect(materializeSpy).not.toHaveBeenCalled();
    handle.dispose();
  });

  test("invokes materializer with no dirty filter on sync:snapshot-applied", () => {
    const id = docId("system-core_sys_snap");
    const docSnapshot = { members: {} };
    const { engine } = makeMockEngine({ [id]: docSnapshot });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    eventBus.emit("sync:snapshot-applied", {
      type: "sync:snapshot-applied",
      documentId: id,
      documentType: TEST_DOC_TYPE,
    });

    expect(materializeSpy).toHaveBeenCalledWith(docSnapshot, materializerDb, eventBus, undefined);
    handle.dispose();
  });

  test("dispose unsubscribes both listeners", () => {
    const id = docId("system-core_sys_dispose");
    const { engine } = makeMockEngine({ [id]: { members: {} } });
    const materializerDb = makeMockMaterializerDb();
    const eventBus: EventBus<DataLayerEventMap> = createEventBus();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });
    handle.dispose();

    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: id,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    eventBus.emit("sync:snapshot-applied", {
      type: "sync:snapshot-applied",
      documentId: id,
      documentType: TEST_DOC_TYPE,
    });

    expect(materializeSpy).not.toHaveBeenCalled();
  });

  test("skips silently when no materializer is registered for the document type", () => {
    const id = docId("system-core_sys_unknown");
    const { engine } = makeMockEngine({ [id]: { members: {} } });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    // A SyncDocumentType union is closed at compile time; pretend an unknown
    // value via a typed local so we exercise the registry-miss branch without
    // resorting to inline `as never` in test bodies.
    const unknownDocType: SyncDocumentType = "nonexistent-doc-type" as SyncDocumentType;

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    expect(() => {
      eventBus.emit("sync:changes-merged", {
        type: "sync:changes-merged",
        documentId: id,
        documentType: unknownDocType,
        dirtyEntityTypes: new Set(["member"]),
        conflicts: [],
      });
    }).not.toThrow();

    expect(getMaterializer(unknownDocType)).toBeUndefined();
    handle.dispose();
  });
});
