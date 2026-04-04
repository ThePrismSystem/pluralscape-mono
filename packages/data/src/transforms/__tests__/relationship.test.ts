import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptRelationship,
  decryptRelationshipPage,
  encryptRelationshipInput,
  encryptRelationshipUpdate,
} from "../relationship.js";

import { makeBase64Blob } from "./helpers.js";

import type { RelationshipEncryptedFields, RelationshipRaw } from "../relationship.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { MemberId, RelationshipId, RelationshipType, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);

function makeRawRelationship(overrides?: Partial<RelationshipRaw>): RelationshipRaw {
  return {
    id: "rel_001" as RelationshipId,
    systemId: "sys_test" as SystemId,
    sourceMemberId: "mem_1" as MemberId,
    targetMemberId: "mem_2" as MemberId,
    type: "sibling" as RelationshipType,
    bidirectional: true,
    createdAt: NOW,
    encryptedData: encryptAndEncodeT1(
      { label: "Sibling bond" } satisfies RelationshipEncryptedFields,
      masterKey,
    ),
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("decryptRelationship", () => {
  it("decrypts label from encrypted data", () => {
    const result = decryptRelationship(makeRawRelationship(), masterKey);
    expect(result.label).toBe("Sibling bond");
    expect(result.sourceMemberId).toBe("mem_1");
    expect(result.targetMemberId).toBe("mem_2");
    expect(result.type).toBe("sibling");
    expect(result.bidirectional).toBe(true);
    expect(result.archived).toBe(false);
  });

  it("returns label: null when encryptedData is null", () => {
    const raw = makeRawRelationship({ encryptedData: null });
    const result = decryptRelationship(raw, masterKey);
    expect(result.label).toBeNull();
  });

  it("handles null member IDs", () => {
    const raw = makeRawRelationship({ sourceMemberId: null, targetMemberId: null });
    const result = decryptRelationship(raw, masterKey);
    expect(result.sourceMemberId).toBeNull();
    expect(result.targetMemberId).toBeNull();
  });

  it("returns archived variant with archivedAt", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeRawRelationship({ archived: true, archivedAt });
    const result = decryptRelationship(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeRawRelationship({ archived: true, archivedAt: null });
    expect(() => decryptRelationship(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("throws on corrupted encryptedData", () => {
    const raw = makeRawRelationship({ encryptedData: "not-valid-base64!!!" });
    expect(() => decryptRelationship(raw, masterKey)).toThrow();
  });
});

describe("decryptRelationshipPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = { data: [makeRawRelationship(), makeRawRelationship()], nextCursor: "cursor_abc" };
    const result = decryptRelationshipPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptRelationshipPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptRelationshipInput", () => {
  it("round-trips through decrypt", () => {
    const fields: RelationshipEncryptedFields = { label: "Test Label" };
    const { encryptedData } = encryptRelationshipInput(fields, masterKey);
    const raw = makeRawRelationship({ encryptedData });
    const result = decryptRelationship(raw, masterKey);
    expect(result.label).toBe("Test Label");
  });
});

describe("encryptRelationshipUpdate", () => {
  it("includes version", () => {
    const result = encryptRelationshipUpdate({ label: "Updated" }, 3, masterKey);
    expect(result.version).toBe(3);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("assertRelationshipEncryptedFields", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRawRelationship({ encryptedData: makeBase64Blob("string", masterKey) });
    expect(() => decryptRelationship(raw, masterKey)).toThrow("not an object");
  });

  it("throws when label is missing", () => {
    const raw = makeRawRelationship({
      encryptedData: makeBase64Blob({ notLabel: "x" }, masterKey),
    });
    expect(() => decryptRelationship(raw, masterKey)).toThrow("label");
  });
});
