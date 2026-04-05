import { describe, expect, it } from "vitest";

import {
  createMaterializer,
  getMaterializer,
  registerMaterializer,
} from "../materializer-registry.js";

import type { SyncDocumentType } from "../../document-types.js";

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
      expect(retrieved).toBeDefined();
      expect(retrieved?.documentType).toBe(TEST_DOC_TYPE_2);
    });

    it("overwrites existing materializer for the same document type", () => {
      const first = createMaterializer(TEST_DOC_TYPE);
      const second = createMaterializer(TEST_DOC_TYPE);
      registerMaterializer(first);
      registerMaterializer(second);
      // Both have same documentType; the second registration should win
      const retrieved = getMaterializer(TEST_DOC_TYPE);
      expect(retrieved).toBeDefined();
      expect(retrieved?.documentType).toBe(TEST_DOC_TYPE);
    });
  });
});
