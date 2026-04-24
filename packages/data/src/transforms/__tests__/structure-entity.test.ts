import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptStructureEntity,
  decryptStructureEntityPage,
  encryptStructureEntityInput,
  encryptStructureEntityUpdate,
} from "../structure-entity.js";

import { makeBase64Blob } from "./helpers.js";

import type { StructureEntityEncryptedInput, StructureEntityRaw } from "../structure-entity.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  HexColor,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  SystemId,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);

function makeEncryptedFields(): StructureEntityEncryptedInput {
  return {
    name: "Phoenix",
    description: "A fiery entity",
    emoji: "🔥",
    color: "#ff4500" as HexColor,
    imageSource: null,
  };
}

function makeRaw(overrides?: Partial<StructureEntityRaw>): StructureEntityRaw {
  return {
    id: brandId<SystemStructureEntityId>("se_001"),
    systemId: brandId<SystemId>("sys_test"),
    entityTypeId: brandId<SystemStructureEntityTypeId>("set_001"),
    sortOrder: 0,
    encryptedData: encryptAndEncodeT1(makeEncryptedFields(), masterKey),
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("decryptStructureEntity", () => {
  it("decrypts all fields correctly", () => {
    const result = decryptStructureEntity(makeRaw(), masterKey);

    expect(result.name).toBe("Phoenix");
    expect(result.description).toBe("A fiery entity");
    expect(result.emoji).toBe("🔥");
    expect(result.color).toBe("#ff4500");
    expect(result.imageSource).toBeNull();
    expect(result.sortOrder).toBe(0);
    expect(result.archived).toBe(false);
  });

  it("handles null optional fields", () => {
    const fields: StructureEntityEncryptedInput = {
      name: "Ghost",
      description: null,
      emoji: null,
      color: null,
      imageSource: null,
    };
    const raw = makeRaw({ encryptedData: encryptAndEncodeT1(fields, masterKey) });
    const result = decryptStructureEntity(raw, masterKey);
    expect(result.description).toBeNull();
    expect(result.emoji).toBeNull();
    expect(result.color).toBeNull();
  });

  it("returns archived variant with archivedAt", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeRaw({ archived: true, archivedAt });
    const result = decryptStructureEntity(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeRaw({ archived: true, archivedAt: null });
    expect(() => decryptStructureEntity(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("throws on corrupted data", () => {
    const raw = makeRaw({ encryptedData: "bad-data!!!" });
    expect(() => decryptStructureEntity(raw, masterKey)).toThrow();
  });
});

describe("decryptStructureEntityPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = decryptStructureEntityPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptStructureEntityPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptStructureEntityInput", () => {
  it("round-trips through decrypt", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptStructureEntityInput(fields, masterKey);
    const raw = makeRaw({ encryptedData });
    const result = decryptStructureEntity(raw, masterKey);
    expect(result.name).toBe(fields.name);
    expect(result.description).toBe(fields.description);
  });
});

describe("encryptStructureEntityUpdate", () => {
  it("includes version", () => {
    const result = encryptStructureEntityUpdate(makeEncryptedFields(), 5, masterKey);
    expect(result.version).toBe(5);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("StructureEntityEncryptedInputSchema validation", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = makeRaw({ encryptedData: makeBase64Blob("string", masterKey) });
    expect(() => decryptStructureEntity(raw, masterKey)).toThrow(/expected object/);
  });

  it("throws when name is missing", () => {
    const raw = makeRaw({
      encryptedData: makeBase64Blob({ description: null }, masterKey),
    });
    expect(() => decryptStructureEntity(raw, masterKey)).toThrow(/name/);
  });
});
