import { describe, expect, it, vi } from "vitest";

import { createCrdtQueryBridge } from "../crdt-query-bridge.js";

import type { DocumentSnapshotProvider } from "../crdt-query-bridge.js";
import type { SyncDocumentId } from "@pluralscape/types";

const DOC_ID = "doc-abc-123" as SyncDocumentId;

function makeEngine(snapshot: unknown): {
  engine: DocumentSnapshotProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(() => snapshot);
  return { engine: { getDocumentSnapshot: spy }, spy };
}

describe("createCrdtQueryBridge", () => {
  it("returns query options with the provided queryKey", () => {
    const { engine } = makeEngine({ value: 42 });
    const bridge = createCrdtQueryBridge({ engine });
    const opts = bridge.documentQueryOptions({
      queryKey: ["doc", DOC_ID],
      documentId: DOC_ID,
      project: (d) => d,
    });
    expect(opts.queryKey).toEqual(["doc", DOC_ID]);
  });

  it("queryFn calls engine.getDocumentSnapshot with the documentId", () => {
    const { engine, spy } = makeEngine({ value: 42 });
    const bridge = createCrdtQueryBridge({ engine });
    const opts = bridge.documentQueryOptions({
      queryKey: ["doc", DOC_ID],
      documentId: DOC_ID,
      project: (d) => d,
    });
    opts.queryFn();
    expect(spy).toHaveBeenCalledWith(DOC_ID);
  });

  it("queryFn applies the project function to the snapshot", () => {
    const { engine } = makeEngine({ value: 42 });
    const bridge = createCrdtQueryBridge({ engine });
    const opts = bridge.documentQueryOptions({
      queryKey: ["doc", DOC_ID],
      documentId: DOC_ID,
      project: (d: unknown) => (d as { value: number }).value,
    });
    expect(opts.queryFn()).toBe(42);
  });

  it("queryFn throws when the document is not loaded", () => {
    const { engine } = makeEngine(null);
    const bridge = createCrdtQueryBridge({ engine });
    const opts = bridge.documentQueryOptions({
      queryKey: ["doc", DOC_ID],
      documentId: DOC_ID,
      project: (d) => d,
    });
    expect(() => opts.queryFn()).toThrow(`Document ${DOC_ID} not loaded in sync engine`);
  });
});
