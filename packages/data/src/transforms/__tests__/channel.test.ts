import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptChannel,
  decryptChannelPage,
  encryptChannelInput,
  encryptChannelUpdate,
} from "../channel.js";
import { encryptAndEncodeT1 } from "../decode-blob.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ChannelEncryptedInput, ChannelId, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): ChannelEncryptedInput {
  return { name: "general" };
}

function makeServerChannel(
  fields: ChannelEncryptedInput = makeEncryptedFields(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: brandId<ChannelId>("ch_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    type: "channel" as const,
    parentId: null as ChannelId | null,
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

// ── decryptChannel ────────────────────────────────────────────────────

describe("decryptChannel", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerChannel();
    const result = decryptChannel(raw, masterKey);

    expect(result.id).toBe("ch_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.type).toBe("channel");
    expect(result.parentId).toBeNull();
    expect(result.sortOrder).toBe(0);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_001_000_000);
    expect(result.archived).toBe(false);
    expect(result.name).toBe("general");
  });

  it("handles category type with parentId", () => {
    const raw = {
      ...makeServerChannel(),
      type: "category" as const,
      parentId: brandId<ChannelId>("ch_parent"),
    };
    const result = decryptChannel(raw, masterKey);
    expect(result.type).toBe("category");
    expect(result.parentId).toBe("ch_parent");
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerChannel(), encryptedData: "not-valid-base64!!!" };
    expect(() => decryptChannel(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerChannel(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptChannel(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.name).toBe("general");
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerChannel(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptChannel(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── decryptChannelPage ────────────────────────────────────────────────

describe("decryptChannelPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerChannel(), makeServerChannel()];
    const result = decryptChannelPage({ data, nextCursor: "cursor-token" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.data.forEach((c) => {
      expect(c.name).toBe("general");
    });
  });

  it("handles null cursor", () => {
    const result = decryptChannelPage({ data: [makeServerChannel()], nextCursor: null }, masterKey);
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty data array", () => {
    const result = decryptChannelPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptChannelInput ───────────────────────────────────────────────

describe("encryptChannelInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptChannelInput(makeEncryptedFields(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptChannelInput(fields, masterKey);
    const result = decryptChannel({ ...makeServerChannel(), encryptedData }, masterKey);
    expect(result.name).toBe(fields.name);
  });

  it("produces different ciphertext on each call", () => {
    const r1 = encryptChannelInput(makeEncryptedFields(), masterKey);
    const r2 = encryptChannelInput(makeEncryptedFields(), masterKey);
    expect(r1.encryptedData).not.toBe(r2.encryptedData);
  });
});

// ── encryptChannelUpdate ──────────────────────────────────────────────

describe("encryptChannelUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptChannelUpdate(makeEncryptedFields(), 5, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(5);
  });

  it("round-trips through decryptChannel", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptChannelUpdate(fields, 2, masterKey);
    const result = decryptChannel({ ...makeServerChannel(), encryptedData, version: 2 }, masterKey);
    expect(result.name).toBe(fields.name);
  });
});

// ── ChannelEncryptedInputSchema ──────────────────────────────────────

describe("ChannelEncryptedInputSchema validation", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = {
      ...makeServerChannel(),
      encryptedData: makeBase64Blob("not-an-object", masterKey),
    };
    expect(() => decryptChannel(raw, masterKey)).toThrow(/object/);
  });

  it("throws when blob is missing name field", () => {
    const raw = { ...makeServerChannel(), encryptedData: makeBase64Blob({}, masterKey) };
    expect(() => decryptChannel(raw, masterKey)).toThrow(/name/);
  });

  it("throws when name is not a string", () => {
    const raw = { ...makeServerChannel(), encryptedData: makeBase64Blob({ name: 42 }, masterKey) };
    expect(() => decryptChannel(raw, masterKey)).toThrow(/name/);
  });
});
