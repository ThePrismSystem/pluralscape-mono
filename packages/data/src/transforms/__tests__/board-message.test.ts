import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptBoardMessage,
  decryptBoardMessagePage,
  encryptBoardMessageInput,
  encryptBoardMessageUpdate,
} from "../board-message.js";
import { encryptAndEncodeT1 } from "../decode-blob.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  BoardMessageEncryptedInput,
  BoardMessageId,
  MemberId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): BoardMessageEncryptedInput {
  return {
    content: "A board message from the host.",
    senderId: brandId<MemberId>("mem_host001"),
  };
}

function makeServerBoardMessage(
  fields: BoardMessageEncryptedInput = makeEncryptedFields(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: brandId<BoardMessageId>("bm_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    pinned: false,
    sortOrder: 0,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

// ── decryptBoardMessage ───────────────────────────────────────────────

describe("decryptBoardMessage", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerBoardMessage();
    const result = decryptBoardMessage(raw, masterKey);

    expect(result.id).toBe("bm_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.pinned).toBe(false);
    expect(result.sortOrder).toBe(0);
    expect(result.version).toBe(1);
    expect(result.archived).toBe(false);
    expect(result.content).toBe("A board message from the host.");
    expect(result.senderId).toBe("mem_host001");
  });

  it("handles pinned board message", () => {
    const raw = { ...makeServerBoardMessage(), pinned: true, sortOrder: 3 };
    const result = decryptBoardMessage(raw, masterKey);
    expect(result.pinned).toBe(true);
    expect(result.sortOrder).toBe(3);
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerBoardMessage(), encryptedData: "!!!" };
    expect(() => decryptBoardMessage(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerBoardMessage(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptBoardMessage(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.content).toBe("A board message from the host.");
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerBoardMessage(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptBoardMessage(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── decryptBoardMessagePage ───────────────────────────────────────────

describe("decryptBoardMessagePage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerBoardMessage(), makeServerBoardMessage()];
    const result = decryptBoardMessagePage({ data, nextCursor: "bm_cursor" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("bm_cursor");
    result.data.forEach((m) => {
      expect(m.content).toBe("A board message from the host.");
    });
  });

  it("handles null cursor and empty data", () => {
    const result = decryptBoardMessagePage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptBoardMessageInput ──────────────────────────────────────────

describe("encryptBoardMessageInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptBoardMessageInput(makeEncryptedFields(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptBoardMessageInput(fields, masterKey);
    const result = decryptBoardMessage({ ...makeServerBoardMessage(), encryptedData }, masterKey);

    expect(result.content).toBe(fields.content);
    expect(result.senderId).toBe(fields.senderId);
  });
});

// ── encryptBoardMessageUpdate ─────────────────────────────────────────

describe("encryptBoardMessageUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptBoardMessageUpdate(makeEncryptedFields(), 3, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(3);
  });

  it("round-trips through decryptBoardMessage", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptBoardMessageUpdate(fields, 2, masterKey);
    const result = decryptBoardMessage(
      { ...makeServerBoardMessage(), encryptedData, version: 2 },
      masterKey,
    );
    expect(result.content).toBe(fields.content);
  });
});

// ── BoardMessageEncryptedInputSchema ─────────────────────────────────

describe("BoardMessageEncryptedInputSchema validation", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = { ...makeServerBoardMessage(), encryptedData: makeBase64Blob(null, masterKey) };
    expect(() => decryptBoardMessage(raw, masterKey)).toThrow(/object/);
  });

  it("throws when blob is missing content field", () => {
    const raw = {
      ...makeServerBoardMessage(),
      encryptedData: makeBase64Blob({ senderId: "mem_x" }, masterKey),
    };
    expect(() => decryptBoardMessage(raw, masterKey)).toThrow(/content/);
  });

  it("throws when blob is missing senderId field", () => {
    const raw = {
      ...makeServerBoardMessage(),
      encryptedData: makeBase64Blob({ content: "hi" }, masterKey),
    };
    expect(() => decryptBoardMessage(raw, masterKey)).toThrow(/senderId/);
  });
});
