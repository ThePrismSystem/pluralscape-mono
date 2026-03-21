import { describe, expect, it } from "vitest";

import {
  AdapterDisposedError,
  DocumentNotFoundError,
  NoChangeProducedError,
  SyncProtocolError,
  SyncTimeoutError,
  UnexpectedResponseError,
  UnsupportedDocumentTypeError,
} from "../errors.js";

describe("sync typed errors", () => {
  describe("SyncProtocolError", () => {
    it("is instanceof Error", () => {
      const err = new SyncProtocolError("INTERNAL_ERROR", "something broke");
      expect(err).toBeInstanceOf(Error);
    });

    it("has name SyncProtocolError", () => {
      const err = new SyncProtocolError("INTERNAL_ERROR", "something broke");
      expect(err.name).toBe("SyncProtocolError");
    });

    it("includes code and message in the error message", () => {
      const err = new SyncProtocolError("PERMISSION_DENIED", "access denied");
      expect(err.message).toBe("SyncError [PERMISSION_DENIED]: access denied");
    });

    it("stores code and docId", () => {
      const err = new SyncProtocolError("INTERNAL_ERROR", "fail", "doc-123");
      expect(err.code).toBe("INTERNAL_ERROR");
      expect(err.docId).toBe("doc-123");
    });

    it("defaults docId to null", () => {
      const err = new SyncProtocolError("INTERNAL_ERROR", "fail");
      expect(err.docId).toBeNull();
    });

    it("can be caught by name", () => {
      try {
        throw new SyncProtocolError("INTERNAL_ERROR", "test");
      } catch (err) {
        expect((err as Error).name).toBe("SyncProtocolError");
      }
    });
  });

  describe("UnexpectedResponseError", () => {
    it("is instanceof Error", () => {
      const err = new UnexpectedResponseError("SnapshotResponse", "ChangesResponse");
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new UnexpectedResponseError("SnapshotResponse", "ChangesResponse");
      expect(err.name).toBe("UnexpectedResponseError");
    });

    it("includes expected and actual types in message", () => {
      const err = new UnexpectedResponseError("SnapshotResponse", "ChangesResponse");
      expect(err.message).toContain("SnapshotResponse");
      expect(err.message).toContain("ChangesResponse");
    });

    it("stores expectedType and actualType", () => {
      const err = new UnexpectedResponseError("A", "B");
      expect(err.expectedType).toBe("A");
      expect(err.actualType).toBe("B");
    });
  });

  describe("SyncTimeoutError", () => {
    it("is instanceof Error", () => {
      const err = new SyncTimeoutError("FetchChangesRequest");
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new SyncTimeoutError("FetchChangesRequest");
      expect(err.name).toBe("SyncTimeoutError");
    });

    it("includes message type in message", () => {
      const err = new SyncTimeoutError("ManifestRequest");
      expect(err.message).toContain("ManifestRequest");
    });

    it("stores messageType", () => {
      const err = new SyncTimeoutError("ManifestRequest");
      expect(err.messageType).toBe("ManifestRequest");
    });
  });

  describe("AdapterDisposedError", () => {
    it("is instanceof Error", () => {
      const err = new AdapterDisposedError();
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new AdapterDisposedError();
      expect(err.name).toBe("AdapterDisposedError");
    });

    it("has default message", () => {
      const err = new AdapterDisposedError();
      expect(err.message).toBe("Adapter disposed");
    });

    it("accepts custom message", () => {
      const err = new AdapterDisposedError("custom disposed msg");
      expect(err.message).toBe("custom disposed msg");
    });
  });

  describe("NoChangeProducedError", () => {
    it("is instanceof Error", () => {
      const err = new NoChangeProducedError();
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new NoChangeProducedError();
      expect(err.name).toBe("NoChangeProducedError");
    });

    it("has default message", () => {
      const err = new NoChangeProducedError();
      expect(err.message).toBe("Automerge.change produced no diff");
    });
  });

  describe("UnsupportedDocumentTypeError", () => {
    it("is instanceof Error", () => {
      const err = new UnsupportedDocumentTypeError("system-core", "time-splitting");
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new UnsupportedDocumentTypeError("system-core", "time-splitting");
      expect(err.name).toBe("UnsupportedDocumentTypeError");
    });

    it("includes document type and operation in message", () => {
      const err = new UnsupportedDocumentTypeError("bucket", "time-splitting");
      expect(err.message).toContain("bucket");
      expect(err.message).toContain("time-splitting");
    });

    it("stores documentType", () => {
      const err = new UnsupportedDocumentTypeError("privacy-config", "time-splitting");
      expect(err.documentType).toBe("privacy-config");
    });
  });

  describe("DocumentNotFoundError", () => {
    it("is instanceof Error", () => {
      const err = new DocumentNotFoundError("doc-missing");
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const err = new DocumentNotFoundError("doc-missing");
      expect(err.name).toBe("DocumentNotFoundError");
    });

    it("includes document ID in message", () => {
      const err = new DocumentNotFoundError("doc-abc-123");
      expect(err.message).toContain("doc-abc-123");
    });

    it("stores documentId", () => {
      const err = new DocumentNotFoundError("doc-abc");
      expect(err.documentId).toBe("doc-abc");
    });
  });
});
