import { describe, expect, it } from "vitest";

import { InvalidDocumentIdError, parseDocumentId } from "../document-types.js";

describe("parseDocumentId", () => {
  describe("system-core documents", () => {
    it("parses system-core-{systemId}", () => {
      const result = parseDocumentId("system-core-sys_abc");
      expect(result).toEqual({
        documentType: "system-core",
        keyType: "derived",
        entityId: "sys_abc",
        timePeriod: null,
      });
    });
  });

  describe("fronting documents", () => {
    it("parses fronting-{systemId}", () => {
      const result = parseDocumentId("fronting-sys_abc");
      expect(result).toEqual({
        documentType: "fronting",
        keyType: "derived",
        entityId: "sys_abc",
        timePeriod: null,
      });
    });

    it("parses fronting-{systemId}-{YYYY-QN}", () => {
      const result = parseDocumentId("fronting-sys_x-2026-Q1");
      expect(result).toEqual({
        documentType: "fronting",
        keyType: "derived",
        entityId: "sys_x",
        timePeriod: "2026-Q1",
      });
    });

    it("parses quarter variants Q1-Q4", () => {
      for (const q of ["1", "2", "3", "4"]) {
        const result = parseDocumentId(`fronting-sys_x-2026-Q${q}`);
        expect(result.timePeriod).toBe(`2026-Q${q}`);
      }
    });
  });

  describe("chat documents", () => {
    it("parses chat-{channelId}", () => {
      const result = parseDocumentId("chat-ch_abc");
      expect(result).toEqual({
        documentType: "chat",
        keyType: "derived",
        entityId: "ch_abc",
        timePeriod: null,
      });
    });

    it("parses chat-{channelId}-{YYYY-MM}", () => {
      const result = parseDocumentId("chat-ch_x-2026-03");
      expect(result).toEqual({
        documentType: "chat",
        keyType: "derived",
        entityId: "ch_x",
        timePeriod: "2026-03",
      });
    });

    it("parses month 01-12", () => {
      const result = parseDocumentId("chat-ch_x-2026-12");
      expect(result.timePeriod).toBe("2026-12");
    });
  });

  describe("journal documents", () => {
    it("parses journal-{systemId}", () => {
      const result = parseDocumentId("journal-sys_abc");
      expect(result).toEqual({
        documentType: "journal",
        keyType: "derived",
        entityId: "sys_abc",
        timePeriod: null,
      });
    });

    it("parses journal-{systemId}-{YYYY}", () => {
      const result = parseDocumentId("journal-sys_x-2026");
      expect(result).toEqual({
        documentType: "journal",
        keyType: "derived",
        entityId: "sys_x",
        timePeriod: "2026",
      });
    });
  });

  describe("note documents", () => {
    it("parses note-{systemId}", () => {
      const result = parseDocumentId("note-sys_abc");
      expect(result).toEqual({
        documentType: "note",
        keyType: "derived",
        entityId: "sys_abc",
        timePeriod: null,
      });
    });

    it("parses note-{systemId}-{YYYY}", () => {
      const result = parseDocumentId("note-sys_x-2026");
      expect(result).toEqual({
        documentType: "note",
        keyType: "derived",
        entityId: "sys_x",
        timePeriod: "2026",
      });
    });
  });

  describe("privacy-config documents", () => {
    it("parses privacy-config-{systemId}", () => {
      const result = parseDocumentId("privacy-config-sys_abc");
      expect(result).toEqual({
        documentType: "privacy-config",
        keyType: "derived",
        entityId: "sys_abc",
        timePeriod: null,
      });
    });
  });

  describe("bucket documents", () => {
    it("parses bucket-{bucketId}", () => {
      const result = parseDocumentId("bucket-bkt_xyz");
      expect(result).toEqual({
        documentType: "bucket",
        keyType: "bucket",
        entityId: "bkt_xyz",
        timePeriod: null,
      });
    });
  });

  describe("key type assignment", () => {
    it("all non-bucket types return keyType derived", () => {
      const derivedDocs = [
        "system-core-sys_a",
        "fronting-sys_a",
        "chat-ch_a",
        "journal-sys_a",
        "note-sys_a",
        "privacy-config-sys_a",
      ];
      for (const docId of derivedDocs) {
        expect(parseDocumentId(docId).keyType).toBe("derived");
      }
    });

    it("bucket returns keyType bucket", () => {
      expect(parseDocumentId("bucket-bkt_a").keyType).toBe("bucket");
    });
  });

  describe("error cases", () => {
    it("throws on empty string", () => {
      expect(() => parseDocumentId("")).toThrow(InvalidDocumentIdError);
    });

    it("throws on unknown prefix", () => {
      expect(() => parseDocumentId("unknown-sys_abc")).toThrow(InvalidDocumentIdError);
    });

    it("throws on missing entity ID", () => {
      expect(() => parseDocumentId("system-core-")).toThrow(InvalidDocumentIdError);
    });

    it("throws on string with no hyphens", () => {
      expect(() => parseDocumentId("nohyphens")).toThrow(InvalidDocumentIdError);
    });

    it("throws when entity ID has no underscore", () => {
      expect(() => parseDocumentId("fronting-2024-Q1")).toThrow(InvalidDocumentIdError);
    });

    it("treats invalid month 00 as part of entity ID (no time split)", () => {
      const result = parseDocumentId("chat-ch_x-2026-00");
      expect(result.documentType).toBe("chat");
      expect(result.entityId).toBe("ch_x-2026-00");
      expect(result.timePeriod).toBeNull();
    });

    it("treats invalid month 13 as part of entity ID (no time split)", () => {
      const result = parseDocumentId("chat-ch_x-2026-13");
      expect(result.documentType).toBe("chat");
      expect(result.entityId).toBe("ch_x-2026-13");
      expect(result.timePeriod).toBeNull();
    });

    it("throws on empty entity after time-period stripping", () => {
      expect(() => parseDocumentId("chat--2026-03")).toThrow(InvalidDocumentIdError);
    });

    it("includes the invalid document ID in the error message", () => {
      expect(() => parseDocumentId("bad-id")).toThrow(InvalidDocumentIdError);
      expect(() => parseDocumentId("bad-id")).toThrow(/bad-id/);
    });
  });
});
