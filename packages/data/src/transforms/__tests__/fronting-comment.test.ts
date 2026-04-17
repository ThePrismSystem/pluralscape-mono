import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptFrontingComment,
  decryptFrontingCommentPage,
  encryptFrontingCommentInput,
  encryptFrontingCommentUpdate,
} from "../fronting-comment.js";

import { makeBase64Blob } from "./helpers.js";

import type { FrontingCommentEncryptedFields } from "../fronting-comment.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Test helpers ──────────────────────────────────────────────────────

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const BASE_COMMENT_RESULT = {
  id: brandId<FrontingCommentId>("fcom_test001"),
  frontingSessionId: brandId<FrontingSessionId>("fs_test001"),
  systemId: brandId<SystemId>("sys_test001"),
  memberId: brandId<MemberId>("mem_test001"),
  customFrontId: null as CustomFrontId | null,
  structureEntityId: null as SystemStructureEntityId | null,
  version: 1,
  archived: false as boolean,
  archivedAt: null as UnixMillis | null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_001_000 as UnixMillis,
};

// ── decryptFrontingComment ────────────────────────────────────────────

describe("decryptFrontingComment", () => {
  it("decrypts content from encrypted blob and passes through transparent fields", () => {
    const encrypted: FrontingCommentEncryptedFields = {
      content: "This is a fronting comment.",
    };
    const raw = { ...BASE_COMMENT_RESULT, encryptedData: makeBase64Blob(encrypted, masterKey) };

    const result = decryptFrontingComment(raw, masterKey);

    expect(result.id).toBe(raw.id);
    expect(result.frontingSessionId).toBe(raw.frontingSessionId);
    expect(result.systemId).toBe(raw.systemId);
    expect(result.memberId).toBe("mem_test001");
    expect(result.customFrontId).toBeNull();
    expect(result.structureEntityId).toBeNull();
    expect(result.content).toBe("This is a fronting comment.");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_001_000);
  });

  it("handles non-null customFrontId and null memberId", () => {
    const encrypted: FrontingCommentEncryptedFields = { content: "Custom front comment." };
    const raw = {
      ...BASE_COMMENT_RESULT,
      memberId: null,
      customFrontId: brandId<CustomFrontId>("cf_001"),
      encryptedData: makeBase64Blob(encrypted, masterKey),
    };

    const result = decryptFrontingComment(raw, masterKey);
    expect(result.memberId).toBeNull();
    expect(result.customFrontId).toBe("cf_001");
    expect(result.content).toBe("Custom front comment.");
  });

  it("throws when encryptedData is not valid base64", () => {
    const raw = { ...BASE_COMMENT_RESULT, encryptedData: "!!!not-base64!!!" };
    expect(() => decryptFrontingComment(raw, masterKey)).toThrow();
  });

  it("throws when encryptedData is corrupted", () => {
    const bytes = new Uint8Array(10).fill(0xff);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const raw = { ...BASE_COMMENT_RESULT, encryptedData: btoa(binary) };
    expect(() => decryptFrontingComment(raw, masterKey)).toThrow();
  });

  it("throws when blob was encrypted with a different key", () => {
    const otherKey = generateMasterKey();
    const encrypted: FrontingCommentEncryptedFields = { content: "secret" };
    const raw = { ...BASE_COMMENT_RESULT, encryptedData: makeBase64Blob(encrypted, masterKey) };
    expect(() => decryptFrontingComment(raw, otherKey)).toThrow();
  });

  it("throws when decrypted blob is missing content field", () => {
    const raw = {
      ...BASE_COMMENT_RESULT,
      encryptedData: makeBase64Blob({ notContent: "oops" }, masterKey),
    };
    expect(() => decryptFrontingComment(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const encrypted: FrontingCommentEncryptedFields = { content: "Archived comment." };
    const archivedAt = 1_700_002_000_000 as UnixMillis;
    const raw = {
      ...BASE_COMMENT_RESULT,
      archived: true,
      archivedAt,
      encryptedData: makeBase64Blob(encrypted, masterKey),
    };
    const result = decryptFrontingComment(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.content).toBe("Archived comment.");
  });
});

// ── decryptFrontingCommentPage ────────────────────────────────────────

describe("decryptFrontingCommentPage", () => {
  it("decrypts all items and passes through nextCursor", () => {
    const encrypted: FrontingCommentEncryptedFields = { content: "Page item." };
    const raw = {
      data: [{ ...BASE_COMMENT_RESULT, encryptedData: makeBase64Blob(encrypted, masterKey) }],
      nextCursor: "fcom_cursor_abc",
    };

    const result = decryptFrontingCommentPage(raw, masterKey);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.content).toBe("Page item.");
    expect(result.nextCursor).toBe("fcom_cursor_abc");
  });

  it("returns empty data and null nextCursor for empty page", () => {
    const result = decryptFrontingCommentPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("decrypts multiple items", () => {
    const enc1: FrontingCommentEncryptedFields = { content: "First comment." };
    const enc2: FrontingCommentEncryptedFields = { content: "Second comment." };
    const raw = {
      data: [
        {
          ...BASE_COMMENT_RESULT,
          id: brandId<FrontingCommentId>("fcom_001"),
          encryptedData: makeBase64Blob(enc1, masterKey),
        },
        {
          ...BASE_COMMENT_RESULT,
          id: brandId<FrontingCommentId>("fcom_002"),
          encryptedData: makeBase64Blob(enc2, masterKey),
        },
      ],
      nextCursor: null,
    };

    const result = decryptFrontingCommentPage(raw, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.content).toBe("First comment.");
    expect(result.data[1]?.content).toBe("Second comment.");
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptFrontingCommentInput ───────────────────────────────────────

describe("encryptFrontingCommentInput", () => {
  it("returns an object with an encryptedData string", () => {
    const input: FrontingCommentEncryptedFields = { content: "New comment content." };
    const result = encryptFrontingCommentInput(input, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: decryptFrontingComment recovers original content", () => {
    const input: FrontingCommentEncryptedFields = { content: "Round-trip test." };
    const { encryptedData } = encryptFrontingCommentInput(input, masterKey);

    const raw = { ...BASE_COMMENT_RESULT, encryptedData };
    const result = decryptFrontingComment(raw, masterKey);
    expect(result.content).toBe("Round-trip test.");
  });

  it("produces different ciphertext on each call (nonce randomness)", () => {
    const input: FrontingCommentEncryptedFields = { content: "Same content." };
    const r1 = encryptFrontingCommentInput(input, masterKey);
    const r2 = encryptFrontingCommentInput(input, masterKey);
    expect(r1.encryptedData).not.toBe(r2.encryptedData);
  });
});

// ── encryptFrontingCommentUpdate ──────────────────────────────────────

describe("encryptFrontingCommentUpdate", () => {
  it("encrypts content and preserves the version number", () => {
    const data: FrontingCommentEncryptedFields = { content: "Updated content." };
    const result = encryptFrontingCommentUpdate(data, 3, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(3);
  });

  it("round-trips: decryptFrontingComment recovers updated content", () => {
    const data: FrontingCommentEncryptedFields = { content: "Updated round-trip." };
    const { encryptedData } = encryptFrontingCommentUpdate(data, 2, masterKey);

    const raw = { ...BASE_COMMENT_RESULT, encryptedData, version: 2 };
    const result = decryptFrontingComment(raw, masterKey);
    expect(result.content).toBe("Updated round-trip.");
  });
});
