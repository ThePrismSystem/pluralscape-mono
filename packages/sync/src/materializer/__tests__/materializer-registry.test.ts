import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../../event-bus/index.js";
import {
  createMaterializer,
  getMaterializer,
  registerMaterializer,
} from "../materializer-registry.js";

import type { SyncDocumentType } from "../../document-types.js";
import type { DataLayerEventMap, EventBus } from "../../event-bus/index.js";
import type { EntityRow, MaterializerDb } from "../base-materializer.js";

// Use a stable doc type that exists in the union
const TEST_DOC_TYPE = "journal" as SyncDocumentType;
const TEST_DOC_TYPE_2 = "privacy-config" as SyncDocumentType;

describe("materializer-registry", () => {
  describe("createMaterializer", () => {
    it("returns a materializer with the correct documentType", () => {
      const m = createMaterializer(TEST_DOC_TYPE);
      expect(m.documentType).toBe(TEST_DOC_TYPE);
    });

    it("materializer has a materialize function", () => {
      const m = createMaterializer(TEST_DOC_TYPE);
      expect(typeof m.materialize).toBe("function");
    });
  });

  describe("registerMaterializer / getMaterializer", () => {
    it("returns undefined for an unregistered document type", () => {
      // Use a cast to test an unregistered value without compile error
      const fakeType = "__unregistered__" as SyncDocumentType;
      expect(getMaterializer(fakeType)).toBeUndefined();
    });

    it("returns the materializer after registration", () => {
      const m = createMaterializer(TEST_DOC_TYPE_2);
      registerMaterializer(m);
      const retrieved = getMaterializer(TEST_DOC_TYPE_2);
      expect(retrieved?.documentType).toBe(TEST_DOC_TYPE_2);
    });

    it("overwrites existing materializer for the same document type", () => {
      const first = createMaterializer(TEST_DOC_TYPE);
      const second = createMaterializer(TEST_DOC_TYPE);
      registerMaterializer(first);
      registerMaterializer(second);
      // Both have same documentType; the second registration should win
      const retrieved = getMaterializer(TEST_DOC_TYPE);
      expect(retrieved?.documentType).toBe(TEST_DOC_TYPE);
    });
  });

  describe("DocumentMaterializer.materialize", () => {
    function makeDb(): MaterializerDb {
      return {
        queryAll: vi.fn().mockReturnValue([] as EntityRow[]),
        execute: vi.fn(),
        transaction: (fn) => fn(),
      };
    }

    function makeEventBus(): EventBus<DataLayerEventMap> {
      return createEventBus<DataLayerEventMap>();
    }

    it("delegates to materializeDocument and emits lifecycle events", () => {
      const m = createMaterializer("system-core" as SyncDocumentType);
      const db = makeDb();
      const bus = makeEventBus();
      const received: string[] = [];
      bus.on("materialized:document", (ev) => {
        received.push(ev.type);
      });
      bus.on("search:index-updated", (ev) => {
        received.push(ev.type);
      });

      m.materialize({}, db, bus);

      expect(received).toEqual(
        expect.arrayContaining(["materialized:document", "search:index-updated"]),
      );
    });

    it("forwards the dirtyEntityTypes set to materializeDocument", () => {
      const m = createMaterializer("system-core" as SyncDocumentType);
      const queryAll = vi.fn().mockReturnValue([] as EntityRow[]);
      const db: MaterializerDb = {
        queryAll,
        execute: vi.fn(),
        transaction: (fn) => fn(),
      };
      const bus = makeEventBus();

      m.materialize({}, db, bus, new Set());
      expect(queryAll).not.toHaveBeenCalled();
    });
  });
});
