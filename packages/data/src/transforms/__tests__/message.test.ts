import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptMessage,
  decryptMessagePage,
  encryptMessageInput,
  encryptMessageUpdate,
} from "../message.js";

import { makeBase64Blob } from "./helpers.js";

import type { MessageEncryptedFields } from "../message.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  BlobId,
  ChannelId,
  MemberId,
  MessageId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): MessageEncryptedFields {
  return {
    content: "Hello, world!",
    attachments: [],
    mentions: [],
    senderId: "mem_sender1" as MemberId,
  };
}

function makeServerMessage(
  fields: MessageEncryptedFields = makeEncryptedFields(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: "msg_abc123" as MessageId,
    channelId: "ch_channel1" as ChannelId,
    systemId: "sys_xyz789" as SystemId,
    replyToId: null as MessageId | null,
    timestamp: toUnixMillis(1_700_000_000_000),
    editedAt: null as UnixMillis | null,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

// ── decryptMessage ────────────────────────────────────────────────────

describe("decryptMessage", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerMessage();
    const result = decryptMessage(raw, masterKey);

    expect(result.id).toBe("msg_abc123");
    expect(result.channelId).toBe("ch_channel1");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.replyToId).toBeNull();
    expect(result.editedAt).toBeNull();
    expect(result.version).toBe(1);
    expect(result.archived).toBe(false);
    expect(result.content).toBe("Hello, world!");
    expect(result.senderId).toBe("mem_sender1");
    expect(result.attachments).toEqual([]);
    expect(result.mentions).toEqual([]);
  });

  it("handles attachments and mentions", () => {
    const fields: MessageEncryptedFields = {
      content: "Check this out",
      attachments: ["blob_001" as BlobId, "blob_002" as BlobId],
      mentions: ["mem_xyz" as MemberId],
      senderId: "mem_sender1" as MemberId,
    };
    const raw = makeServerMessage(fields);
    const result = decryptMessage(raw, masterKey);

    expect(result.attachments).toEqual(["blob_001", "blob_002"]);
    expect(result.mentions).toEqual(["mem_xyz"]);
  });

  it("handles replyToId", () => {
    const raw = { ...makeServerMessage(), replyToId: "msg_parent" as MessageId };
    const result = decryptMessage(raw, masterKey);
    expect(result.replyToId).toBe("msg_parent");
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerMessage(), encryptedData: "!!!" };
    expect(() => decryptMessage(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerMessage(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptMessage(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.content).toBe("Hello, world!");
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerMessage(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptMessage(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── decryptMessagePage ────────────────────────────────────────────────

describe("decryptMessagePage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerMessage(), makeServerMessage()];
    const result = decryptMessagePage({ data, nextCursor: "msg_cursor" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("msg_cursor");
    result.data.forEach((m) => { expect(m.content).toBe("Hello, world!"); });
  });

  it("handles null cursor and empty data", () => {
    const result = decryptMessagePage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptMessageInput ───────────────────────────────────────────────

describe("encryptMessageInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptMessageInput(makeEncryptedFields(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptMessageInput(fields, masterKey);
    const result = decryptMessage({ ...makeServerMessage(), encryptedData }, masterKey);

    expect(result.content).toBe(fields.content);
    expect(result.senderId).toBe(fields.senderId);
    expect(result.attachments).toEqual(fields.attachments);
    expect(result.mentions).toEqual(fields.mentions);
  });
});

// ── encryptMessageUpdate ──────────────────────────────────────────────

describe("encryptMessageUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptMessageUpdate(makeEncryptedFields(), 4, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(4);
  });

  it("round-trips through decryptMessage", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptMessageUpdate(fields, 2, masterKey);
    const result = decryptMessage({ ...makeServerMessage(), encryptedData, version: 2 }, masterKey);
    expect(result.content).toBe(fields.content);
  });
});

// ── assertMessageEncryptedFields ──────────────────────────────────────

describe("assertMessageEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = { ...makeServerMessage(), encryptedData: makeBase64Blob(42, masterKey) };
    expect(() => decryptMessage(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing content field", () => {
    const raw = {
      ...makeServerMessage(),
      encryptedData: makeBase64Blob(
        { senderId: "mem_x", attachments: [], mentions: [] },
        masterKey,
      ),
    };
    expect(() => decryptMessage(raw, masterKey)).toThrow("missing required string field: content");
  });

  it("throws when blob is missing senderId field", () => {
    const raw = {
      ...makeServerMessage(),
      encryptedData: makeBase64Blob({ content: "hi", attachments: [], mentions: [] }, masterKey),
    };
    expect(() => decryptMessage(raw, masterKey)).toThrow("missing required string field: senderId");
  });

  it("throws when blob is missing attachments array", () => {
    const raw = {
      ...makeServerMessage(),
      encryptedData: makeBase64Blob({ content: "hi", senderId: "mem_x", mentions: [] }, masterKey),
    };
    expect(() => decryptMessage(raw, masterKey)).toThrow(
      "missing required array field: attachments",
    );
  });

  it("throws when blob is missing mentions array", () => {
    const raw = {
      ...makeServerMessage(),
      encryptedData: makeBase64Blob(
        { content: "hi", senderId: "mem_x", attachments: [] },
        masterKey,
      ),
    };
    expect(() => decryptMessage(raw, masterKey)).toThrow("missing required array field: mentions");
  });
});
