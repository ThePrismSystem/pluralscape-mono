import {
  createEventBus,
  NoActiveSessionError,
  type DataLayerEventMap,
  type EventBus,
} from "@pluralscape/sync";
import {
  getMaterializer,
  registerMaterializer,
  type DocumentMaterializer,
  type MaterializerDb,
} from "@pluralscape/sync/materializer";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createMaterializerSubscriber } from "../materializer-subscriber.js";

import type { DocumentSnapshotProvider } from "../crdt-query-bridge.js";
import type { SyncDocumentId, SyncDocumentType } from "@pluralscape/types";

function makeMockMaterializerDb(): MaterializerDb {
  return {
    queryAll: vi.fn(() => []),
    execute: vi.fn(),
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };
}

function makeMockEngine(resolveSnapshot: (id: SyncDocumentId) => unknown): {
  engine: DocumentSnapshotProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(resolveSnapshot);
  return { engine: { getDocumentSnapshot: spy }, spy };
}

function snapshotsByDocId(snapshots: Record<string, unknown>): {
  engine: DocumentSnapshotProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  return makeMockEngine((id) => snapshots[String(id)]);
}

function docId(raw: string): SyncDocumentId {
  return brandId<SyncDocumentId>(raw);
}

const TEST_DOC_TYPE = "system-core" as const;

// ── Registry save/restore so the auto-registered system-core materializer is
// reinstated between tests (registerMaterializer overwrites silently).
let originalMaterializer: DocumentMaterializer | undefined;

beforeEach(() => {
  originalMaterializer = getMaterializer(TEST_DOC_TYPE);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMaterializer) {
    registerMaterializer(originalMaterializer);
  }
});

describe("createMaterializerSubscriber", () => {
  test("calls registered materializer on sync:changes-merged", () => {
    const id = docId("system-core_sys_test1");
    const docSnapshot = { members: {} };
    const { engine, spy } = snapshotsByDocId({ [id]: docSnapshot });
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

  test("wraps the materialize call in a single materializerDb.transaction", () => {
    const id = docId("system-core_sys_tx");
    const docSnapshot = { members: { mem_1: { id: "mem_1" } } };
    const { engine } = snapshotsByDocId({ [id]: docSnapshot });
    const materializerDb = makeMockMaterializerDb();
    const transactionSpy = vi.spyOn(materializerDb, "transaction");
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

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    // The materialize callback ran inside the transaction's sync identity wrap.
    expect(materializeSpy).toHaveBeenCalledTimes(1);
    handle.dispose();
  });

  test("treats NoActiveSessionError as a benign skip without emitting sync:error", () => {
    const id = docId("system-core_sys_evicted");
    const { engine } = makeMockEngine(() => {
      throw new NoActiveSessionError(String(id));
    });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();
    const errorEvents: unknown[] = [];
    eventBus.on("sync:error", (e) => errorEvents.push(e));

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
    expect(errorEvents).toHaveLength(0);
    handle.dispose();
  });

  test("emits sync:error when getDocumentSnapshot throws something other than NoActiveSessionError", () => {
    const id = docId("system-core_sys_disk");
    const failure = new Error("disk read failed");
    const { engine } = makeMockEngine(() => {
      throw failure;
    });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();
    const errorEvents: { message: string; error: unknown }[] = [];
    eventBus.on("sync:error", (e) => errorEvents.push({ message: e.message, error: e.error }));

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
    expect(errorEvents).toEqual([{ message: "materializer snapshot read failed", error: failure }]);
    handle.dispose();
  });

  test("emits sync:error when materialize throws and continues handling subsequent emits", () => {
    const id = docId("system-core_sys_writefail");
    const docSnapshot = { members: {} };
    const { engine } = snapshotsByDocId({ [id]: docSnapshot });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();
    const errorEvents: { message: string; error: unknown }[] = [];
    eventBus.on("sync:error", (e) => errorEvents.push({ message: e.message, error: e.error }));

    const writeFailure = new Error("INSERT OR REPLACE failed");
    let calls = 0;
    const materializeSpy = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw writeFailure;
    });
    registerMaterializer({ documentType: TEST_DOC_TYPE, materialize: materializeSpy });

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });

    // First emit triggers a throw inside materialize → sync:error
    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: id,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });
    // Second emit must still reach the materialize handler — listener didn't crash
    eventBus.emit("sync:changes-merged", {
      type: "sync:changes-merged",
      documentId: id,
      documentType: TEST_DOC_TYPE,
      dirtyEntityTypes: new Set(["member"]),
      conflicts: [],
    });

    expect(materializeSpy).toHaveBeenCalledTimes(2);
    expect(errorEvents).toEqual([{ message: "materializer write failed", error: writeFailure }]);
    handle.dispose();
  });

  test("invokes materializer with no dirty filter on sync:snapshot-applied", () => {
    const id = docId("system-core_sys_snap");
    const docSnapshot = { members: {} };
    const { engine } = snapshotsByDocId({ [id]: docSnapshot });
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

  test("skips silently when getDocumentSnapshot returns null", () => {
    const id = docId("system-core_sys_null");
    const { engine } = makeMockEngine(() => null);
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();
    const errorEvents: unknown[] = [];
    eventBus.on("sync:error", (e) => errorEvents.push(e));

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
    expect(errorEvents).toHaveLength(0);
    handle.dispose();
  });

  test("dispose unsubscribes both listeners", () => {
    const id = docId("system-core_sys_dispose");
    const { engine } = snapshotsByDocId({ [id]: { members: {} } });
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

  test("dispose is idempotent — calling twice is safe", () => {
    const id = docId("system-core_sys_idem");
    const { engine } = snapshotsByDocId({ [id]: { members: {} } });
    const materializerDb = makeMockMaterializerDb();
    const eventBus = createEventBus<DataLayerEventMap>();

    const handle = createMaterializerSubscriber({ engine, materializerDb, eventBus });
    handle.dispose();
    expect(() => {
      handle.dispose();
    }).not.toThrow();
  });

  test("skips silently when no materializer is registered for the document type", () => {
    const id = docId("system-core_sys_unknown");
    const { engine } = snapshotsByDocId({ [id]: { members: {} } });
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
