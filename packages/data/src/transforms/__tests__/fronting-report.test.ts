import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptFrontingReport,
  decryptFrontingReportPage,
  encryptFrontingReportInput,
} from "../fronting-report.js";

import { makeBase64Blob } from "./helpers.js";

import type { FrontingReportEncryptedFields } from "../fronting-report.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { FrontingReportId, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

const REPORT_ID = "fr_test001" as FrontingReportId;
const SYSTEM_ID = "sys_test" as SystemId;
const NOW = 1700000000000 as UnixMillis;
const START = 1699000000000 as UnixMillis;

const ENCRYPTED_FIELDS: FrontingReportEncryptedFields = {
  dateRange: { start: START, end: NOW },
  memberBreakdowns: [],
  chartData: [],
};

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeRawReport(encryptedData: string) {
  return {
    id: REPORT_ID,
    systemId: SYSTEM_ID,
    encryptedData,
    format: "html" as const,
    generatedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("decryptFrontingReport", () => {
  it("decrypts and returns domain type", () => {
    const raw = makeRawReport(encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey));
    const result = decryptFrontingReport(raw, masterKey);

    expect(result.id).toBe(REPORT_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.format).toBe("html");
    expect(result.generatedAt).toBe(NOW);
    expect(result.dateRange).toEqual(ENCRYPTED_FIELDS.dateRange);
  });

  it("throws with wrong key", () => {
    const raw = makeRawReport(encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey));
    const wrongKey = generateMasterKey();
    expect(() => decryptFrontingReport(raw, wrongKey)).toThrow();
  });

  it("throws on invalid base64", () => {
    expect(() => decryptFrontingReport(makeRawReport("!!!"), masterKey)).toThrow();
  });
});

describe("decryptFrontingReportPage", () => {
  it("decrypts all items and preserves pagination", () => {
    const enc = encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey);
    const raw = { data: [makeRawReport(enc), makeRawReport(enc)], nextCursor: "c1" };
    const result = decryptFrontingReportPage(raw, masterKey);

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("c1");
  });

  it("handles null nextCursor", () => {
    const enc = encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey);
    const result = decryptFrontingReportPage(
      { data: [makeRawReport(enc)], nextCursor: null },
      masterKey,
    );
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptFrontingReportInput", () => {
  it("round-trips correctly", () => {
    const encrypted = encryptFrontingReportInput(ENCRYPTED_FIELDS, masterKey);
    const raw = makeRawReport(encrypted.encryptedData);
    const result = decryptFrontingReport(raw, masterKey);
    expect(result.dateRange).toEqual(ENCRYPTED_FIELDS.dateRange);
  });

  it("produces different ciphertext each call (random nonce)", () => {
    const a = encryptFrontingReportInput(ENCRYPTED_FIELDS, masterKey);
    const b = encryptFrontingReportInput(ENCRYPTED_FIELDS, masterKey);
    expect(a.encryptedData).not.toBe(b.encryptedData);
  });
});

// ── Assertion guard tests ────────────────────────────────────────────


describe("assertFrontingReportEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = makeRawReport(makeBase64Blob("not-an-object", masterKey));
    expect(() => decryptFrontingReport(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing dateRange field", () => {
    const raw = makeRawReport(makeBase64Blob({ memberBreakdowns: [] }, masterKey));
    expect(() => decryptFrontingReport(raw, masterKey)).toThrow(
      "missing required object field: dateRange",
    );
  });

  it("throws when dateRange is null", () => {
    const raw = makeRawReport(makeBase64Blob({ dateRange: null }, masterKey));
    expect(() => decryptFrontingReport(raw, masterKey)).toThrow(
      "missing required object field: dateRange",
    );
  });
});
