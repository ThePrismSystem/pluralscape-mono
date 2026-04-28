import { createEventBus, type DataLayerEventMap, type EventBus } from "@pluralscape/sync";
import {
  getMaterializer,
  registerMaterializer,
  type MaterializerDb,
} from "@pluralscape/sync/materializer";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createMaterializerSubscriber } from "../materializer-subscriber.js";

import type { DocumentSnapshotProvider } from "../crdt-query-bridge.js";
import type { SyncDocumentId } from "@pluralscape/types";

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

const TEST_DOC_TYPE = "system-core" as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMaterializerSubscriber", () => {
  test("calls registered materializer on sync:changes-merged", () => {
    const docId = "system-core_sys_test1" as SyncDocumentId;
    const docSnapshot = { members: {} };
    const { engine, spy } = makeMockEngine({ [docId]: docSnapshot });
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
      documentId: docId,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    expect(spy).toHaveBeenCalledWith(docId);
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
    const docId = "system-core_sys_evicted" as SyncDocumentId;
    const { engine } = makeMockEngine({});
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: docId,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    expect(materializeSpy).not.toHaveBeenCalled();
    handle.dispose();
  });

  test("invokes materializer with no dirty filter on sync:snapshot-applied", () => {
    const docId = "system-core_sys_snap" as SyncDocumentId;
    const docSnapshot = { members: {} };
    const { engine } = makeMockEngine({ [docId]: docSnapshot });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    eventBus.emit("sync:snapshot-applied", {
      type: "sync:snapshot-applied",
      documentId: docId,
      documentType: TEST_DOC_TYPE,
    });

    expect(materializeSpy).toHaveBeenCalledWith(docSnapshot, materializerDb, eventBus, undefined);
    handle.dispose();
  });

  test("dispose unsubscribes both listeners", () => {
    const docId = "system-core_sys_dispose" as SyncDocumentId;
    const { engine } = makeMockEngine({ [docId]: { members: {} } });
    const materializerDb = makeMockMaterializerDb();
    const eventBus: EventBus<DataLayerEventMap> = createEventBus();

    const materializeSpy = vi.fn();
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });
    handle.dispose();

    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: docId,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    eventBus.emit("sync:snapshot-applied", {
      type: "sync:snapshot-applied",
      documentId: docId,
      documentType: TEST_DOC_TYPE,
    });

    expect(materializeSpy).not.toHaveBeenCalled();
  });

  test("skips silently when no materializer is registered for the document type", () => {
    const docId = "system-core_sys_unknown" as SyncDocumentId;
    const { engine } = makeMockEngine({ [docId]: { members: {} } });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    expect(() => {
      eventBus.emit("sync:changes-merged", {
        type: "sync:changes-merged",
        documentId: docId,
        documentType: "nonexistent-doc-type" as never,
        dirtyEntityTypes: new Set(["member"]),
        conflicts: [],
      });
    }).not.toThrow();

    expect(getMaterializer("nonexistent-doc-type" as never)).toBeUndefined();
    handle.dispose();
  });
});
