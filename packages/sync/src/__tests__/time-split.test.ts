import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { parseDocumentId } from "../document-types.js";
import { createFrontingDocument } from "../factories/document-factory.js";
import { EncryptedSyncSession } from "../sync-session.js";
import {
  checkTimeSplitEligibility,
  computeNewDocumentId,
  computeNextTimePeriod,
  splitDocument,
} from "../time-split.js";

import type { FrontingDocument } from "../schemas/fronting.js";
import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

function makeKeys(s: SodiumAdapter): DocumentKeys {
  return {
    encryptionKey: s.aeadKeygen(),
    signingKeys: s.signKeypair(),
  };
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

describe("computeNextTimePeriod", () => {
  it("computes quarter for Q1 (January)", () => {
    const jan = Date.UTC(2026, 0, 15);
    expect(computeNextTimePeriod("quarter", jan)).toBe("2026-Q1");
  });

  it("computes quarter for Q2 (April)", () => {
    const apr = Date.UTC(2026, 3, 1);
    expect(computeNextTimePeriod("quarter", apr)).toBe("2026-Q2");
  });

  it("computes quarter for Q3 (July)", () => {
    const jul = Date.UTC(2026, 6, 15);
    expect(computeNextTimePeriod("quarter", jul)).toBe("2026-Q3");
  });

  it("computes quarter for Q4 (December)", () => {
    const dec = Date.UTC(2026, 11, 31);
    expect(computeNextTimePeriod("quarter", dec)).toBe("2026-Q4");
  });

  it("computes month with zero-padding", () => {
    const mar = Date.UTC(2026, 2, 10);
    expect(computeNextTimePeriod("month", mar)).toBe("2026-03");
  });

  it("computes month for December", () => {
    const dec = Date.UTC(2026, 11, 25);
    expect(computeNextTimePeriod("month", dec)).toBe("2026-12");
  });

  it("computes year", () => {
    const ts = Date.UTC(2026, 5, 1);
    expect(computeNextTimePeriod("year", ts)).toBe("2026");
  });

  it("handles year boundary — Dec 31 is still previous year", () => {
    const dec31 = Date.UTC(2025, 11, 31, 23, 59, 59);
    expect(computeNextTimePeriod("quarter", dec31)).toBe("2025-Q4");
    expect(computeNextTimePeriod("year", dec31)).toBe("2025");
  });

  it("handles year boundary — Jan 1 is new year", () => {
    const jan1 = Date.UTC(2026, 0, 1);
    expect(computeNextTimePeriod("quarter", jan1)).toBe("2026-Q1");
    expect(computeNextTimePeriod("year", jan1)).toBe("2026");
  });
});

describe("computeNewDocumentId", () => {
  it("constructs fronting document ID with quarter", () => {
    const parsed = parseDocumentId("fronting-sys_abc");
    expect(computeNewDocumentId(parsed, "2026-Q2")).toBe("fronting-sys_abc-2026-Q2");
  });

  it("constructs chat document ID with month", () => {
    const parsed = parseDocumentId("chat-ch_xyz");
    expect(computeNewDocumentId(parsed, "2026-03")).toBe("chat-ch_xyz-2026-03");
  });

  it("constructs journal document ID with year", () => {
    const parsed = parseDocumentId("journal-sys_abc");
    expect(computeNewDocumentId(parsed, "2026")).toBe("journal-sys_abc-2026");
  });

  it("throws for non-splittable types", () => {
    const parsed = parseDocumentId("system-core-sys_abc");
    expect(() => computeNewDocumentId(parsed, "2026")).toThrow(/does not support time-splitting/);
  });

  it("throws for bucket type", () => {
    const parsed = parseDocumentId("bucket-bkt_abc");
    expect(() => computeNewDocumentId(parsed, "2026")).toThrow(/does not support time-splitting/);
  });
});

describe("checkTimeSplitEligibility", () => {
  it("returns true for fronting above threshold", () => {
    expect(checkTimeSplitEligibility("fronting-sys_abc", 5_242_880)).toBe(true);
  });

  it("returns false for fronting below threshold", () => {
    expect(checkTimeSplitEligibility("fronting-sys_abc", 5_242_879)).toBe(false);
  });

  it("returns true for chat above threshold", () => {
    expect(checkTimeSplitEligibility("chat-ch_abc", 5_242_880)).toBe(true);
  });

  it("returns true for journal above threshold", () => {
    expect(checkTimeSplitEligibility("journal-sys_abc", 10_485_760)).toBe(true);
  });

  it("returns false for journal below threshold", () => {
    expect(checkTimeSplitEligibility("journal-sys_abc", 10_485_759)).toBe(false);
  });

  it("returns false for non-splittable types regardless of size", () => {
    expect(checkTimeSplitEligibility("system-core-sys_abc", 999_999_999)).toBe(false);
    expect(checkTimeSplitEligibility("privacy-config-sys_abc", 999_999_999)).toBe(false);
    expect(checkTimeSplitEligibility("bucket-bkt_abc", 999_999_999)).toBe(false);
  });
});

describe("splitDocument", () => {
  it("new doc has correct ID for fronting", () => {
    const keys = makeKeys(sodium);
    const doc = createFrontingDocument();
    const session = new EncryptedSyncSession<FrontingDocument>({
      doc,
      keys,
      documentId: "fronting-sys_test",
      sodium,
    });

    const jan2026 = Date.UTC(2026, 0, 15);
    const result = splitDocument("fronting-sys_test", session, jan2026);
    expect(result.newDocId).toBe("fronting-sys_test-2026-Q1");
  });

  it("fronting: migrates active sessions (endTime === null)", () => {
    const keys = makeKeys(sodium);
    let doc = createFrontingDocument();

    doc = Automerge.change(doc, (d) => {
      d.sessions["active_1"] = {
        id: new Automerge.ImmutableString("active_1"),
        systemId: new Automerge.ImmutableString("sys_test"),
        memberId: new Automerge.ImmutableString("mem_a"),
        startTime: 1000,
        endTime: null,
        frontingType: new Automerge.ImmutableString("fronting"),
        comment: null,
        customFrontId: null,
        linkedStructure: null,
        positionality: null,
        outtrigger: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      d.sessions["closed_1"] = {
        id: new Automerge.ImmutableString("closed_1"),
        systemId: new Automerge.ImmutableString("sys_test"),
        memberId: new Automerge.ImmutableString("mem_b"),
        startTime: 500,
        endTime: 900,
        frontingType: new Automerge.ImmutableString("fronting"),
        comment: null,
        customFrontId: null,
        linkedStructure: null,
        positionality: null,
        outtrigger: null,
        archived: false,
        createdAt: 500,
        updatedAt: 900,
      };
    });

    const session = new EncryptedSyncSession<FrontingDocument>({
      doc,
      keys,
      documentId: "fronting-sys_test",
      sodium,
    });

    const result = splitDocument("fronting-sys_test", session, Date.UTC(2026, 3, 1));
    expect(result.documentType).toBe("fronting");
    expect(result.newDocId).toBe("fronting-sys_test-2026-Q2");

    if (result.documentType === "fronting") {
      expect(Object.keys(result.newDoc.sessions)).toContain("active_1");
      expect(Object.keys(result.newDoc.sessions)).not.toContain("closed_1");
    }
  });

  it("throws if fronting docId is paired with a non-fronting document shape", () => {
    const keys = makeKeys(sodium);
    const wrongDoc = Automerge.from({ sessions: {}, switches: [] });
    const session = new EncryptedSyncSession({
      doc: wrongDoc,
      keys,
      documentId: "fronting-sys_test",
      sodium,
    });
    expect(() => splitDocument("fronting-sys_test", session)).toThrow(
      /does not match expected FrontingDocument/,
    );
  });

  it("fronting: old document is unchanged", () => {
    const keys = makeKeys(sodium);
    let doc = createFrontingDocument();

    doc = Automerge.change(doc, (d) => {
      d.sessions["active_1"] = {
        id: new Automerge.ImmutableString("active_1"),
        systemId: new Automerge.ImmutableString("sys_test"),
        memberId: new Automerge.ImmutableString("mem_a"),
        startTime: 1000,
        endTime: null,
        frontingType: new Automerge.ImmutableString("fronting"),
        comment: null,
        customFrontId: null,
        linkedStructure: null,
        positionality: null,
        outtrigger: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const session = new EncryptedSyncSession<FrontingDocument>({
      doc,
      keys,
      documentId: "fronting-sys_test",
      sodium,
    });

    splitDocument("fronting-sys_test", session, Date.UTC(2026, 0, 1));

    // Original doc still has the session
    expect(Object.keys(session.document.sessions)).toContain("active_1");
  });

  it("chat: new doc starts empty", () => {
    const keys = makeKeys(sodium);
    const doc = Automerge.from({ channel: {}, messages: [] });
    const session = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "chat-ch_test",
      sodium,
    });

    const result = splitDocument("chat-ch_test", session, Date.UTC(2026, 2, 15));
    expect(result.newDocId).toBe("chat-ch_test-2026-03");
  });

  it("journal: new doc starts empty", () => {
    const keys = makeKeys(sodium);
    const doc = Automerge.from({ entries: {}, wikiPages: {}, notes: {} });
    const session = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "journal-sys_test",
      sodium,
    });

    const result = splitDocument("journal-sys_test", session, Date.UTC(2026, 5, 1));
    expect(result.newDocId).toBe("journal-sys_test-2026");
  });

  it("throws for non-splittable types", () => {
    const keys = makeKeys(sodium);
    const doc = Automerge.from({ data: {} });
    const session = new EncryptedSyncSession({
      doc,
      keys,
      documentId: "system-core-sys_test",
      sodium,
    });

    expect(() => splitDocument("system-core-sys_test", session)).toThrow(
      /does not support time-splitting/,
    );
  });
});
