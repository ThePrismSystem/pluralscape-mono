import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptStructureEntityType,
  decryptStructureEntityTypePage,
  encryptStructureEntityTypeInput,
  encryptStructureEntityTypeUpdate,
} from "../structure-entity-type.js";

import { makeBase64Blob } from "./helpers.js";

import type {
  StructureEntityTypeEncryptedFields,
  StructureEntityTypeRaw,
} from "../structure-entity-type.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { HexColor, SystemStructureEntityTypeId, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);

function makeEncryptedFields(): StructureEntityTypeEncryptedFields {
  return {
    name: "Protector",
    description: "Keeps the system safe",
    emoji: "🛡️",
    color: "#0000ff" as HexColor,
    imageSource: null,
  };
}

function makeRaw(overrides?: Partial<StructureEntityTypeRaw>): StructureEntityTypeRaw {
  return {
    id: brandId<SystemStructureEntityTypeId>("set_001"),
    systemId: brandId<SystemId>("sys_test"),
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

describe("decryptStructureEntityType", () => {
  it("decrypts all fields correctly", () => {
    const result = decryptStructureEntityType(makeRaw(), masterKey);

    expect(result.name).toBe("Protector");
    expect(result.description).toBe("Keeps the system safe");
    expect(result.emoji).toBe("🛡️");
    expect(result.color).toBe("#0000ff");
    expect(result.imageSource).toBeNull();
    expect(result.archived).toBe(false);
  });

  it("handles null optional fields", () => {
    const fields: StructureEntityTypeEncryptedFields = {
      name: "Unknown",
      description: null,
      emoji: null,
      color: null,
      imageSource: null,
    };
    const raw = makeRaw({ encryptedData: encryptAndEncodeT1(fields, masterKey) });
    const result = decryptStructureEntityType(raw, masterKey);
    expect(result.description).toBeNull();
    expect(result.emoji).toBeNull();
    expect(result.color).toBeNull();
  });

  it("returns archived variant with archivedAt", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeRaw({ archived: true, archivedAt });
    const result = decryptStructureEntityType(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeRaw({ archived: true, archivedAt: null });
    expect(() => decryptStructureEntityType(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("throws on corrupted data", () => {
    const raw = makeRaw({ encryptedData: "bad-data!!!" });
    expect(() => decryptStructureEntityType(raw, masterKey)).toThrow();
  });
});

describe("decryptStructureEntityTypePage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = decryptStructureEntityTypePage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptStructureEntityTypePage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptStructureEntityTypeInput", () => {
  it("round-trips through decrypt", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptStructureEntityTypeInput(fields, masterKey);
    const raw = makeRaw({ encryptedData });
    const result = decryptStructureEntityType(raw, masterKey);
    expect(result.name).toBe(fields.name);
  });
});

describe("encryptStructureEntityTypeUpdate", () => {
  it("includes version", () => {
    const result = encryptStructureEntityTypeUpdate(makeEncryptedFields(), 7, masterKey);
    expect(result.version).toBe(7);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("assertStructureEntityTypeEncryptedFields", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRaw({ encryptedData: makeBase64Blob("string", masterKey) });
    expect(() => decryptStructureEntityType(raw, masterKey)).toThrow("not an object");
  });

  it("throws when name is missing", () => {
    const raw = makeRaw({
      encryptedData: makeBase64Blob({ description: null }, masterKey),
    });
    expect(() => decryptStructureEntityType(raw, masterKey)).toThrow("name");
  });
});
