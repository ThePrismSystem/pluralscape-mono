import {
  configureSodium,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptFieldDefinition,
  decryptFieldDefinitionPage,
  decryptFieldValue,
  decryptFieldValueList,
  encryptFieldDefinitionInput,
  encryptFieldValueInput,
} from "../custom-field.js";

import type { FieldDefinitionEncryptedFields, FieldValueDecrypted } from "../custom-field.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { FieldDefinitionId, FieldValueId, SystemId } from "@pluralscape/types";

// ── Test helpers ──────────────────────────────────────────────────────

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

/** Encode a T1 blob to base64 without Buffer. */
function makeBase64Blob(payload: unknown): string {
  const blob = encryptTier1(payload, masterKey);
  const bytes = serializeEncryptedBlob(blob);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const BASE_DEFINITION_RESULT = {
  id: "fld_test123" as FieldDefinitionId,
  systemId: "sys_test456" as SystemId,
  fieldType: "text" as const,
  required: true,
  sortOrder: 1,
  version: 1,
  createdAt: 1_700_000_000_000 as import("@pluralscape/types").UnixMillis,
  updatedAt: 1_700_000_001_000 as import("@pluralscape/types").UnixMillis,
  archived: false as const,
  archivedAt: null,
};

const BASE_VALUE_RESULT = {
  id: "fv_test789" as FieldValueId,
  fieldDefinitionId: "fld_test123" as FieldDefinitionId,
  memberId: null,
  structureEntityId: null,
  groupId: null,
  systemId: "sys_test456" as SystemId,
  version: 1,
  createdAt: 1_700_000_000_000 as import("@pluralscape/types").UnixMillis,
  updatedAt: 1_700_000_001_000 as import("@pluralscape/types").UnixMillis,
};

// ── decryptFieldDefinition ────────────────────────────────────────────

describe("decryptFieldDefinition", () => {
  it("decrypts name, description, and options from the encrypted blob", () => {
    const encrypted: FieldDefinitionEncryptedFields = {
      name: "Pronoun",
      description: "Preferred pronoun",
      options: null,
    };
    const raw = { ...BASE_DEFINITION_RESULT, encryptedData: makeBase64Blob(encrypted) };

    const result = decryptFieldDefinition(raw, masterKey);

    expect(result.id).toBe(raw.id);
    expect(result.systemId).toBe(raw.systemId);
    expect(result.fieldType).toBe("text");
    expect(result.required).toBe(true);
    expect(result.sortOrder).toBe(1);
    expect(result.version).toBe(1);
    expect(result.name).toBe("Pronoun");
    expect(result.description).toBe("Preferred pronoun");
    expect(result.options).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_001_000);
  });

  it("decrypts select field with options array", () => {
    const encrypted: FieldDefinitionEncryptedFields = {
      name: "Role",
      description: null,
      options: ["host", "protector", "gatekeeper"],
    };
    const raw = {
      ...BASE_DEFINITION_RESULT,
      fieldType: "select" as const,
      encryptedData: makeBase64Blob(encrypted),
    };

    const result = decryptFieldDefinition(raw, masterKey);

    expect(result.name).toBe("Role");
    expect(result.description).toBeNull();
    expect(result.options).toEqual(["host", "protector", "gatekeeper"]);
  });

  it("throws when encryptedData is not a valid base64 T1 blob", () => {
    const raw = { ...BASE_DEFINITION_RESULT, encryptedData: "not-valid-base64!!!" };
    expect(() => decryptFieldDefinition(raw, masterKey)).toThrow();
  });

  it("throws when blob was encrypted with a different key", () => {
    const otherKey = generateMasterKey();
    const encrypted: FieldDefinitionEncryptedFields = {
      name: "X",
      description: null,
      options: null,
    };
    const raw = { ...BASE_DEFINITION_RESULT, encryptedData: makeBase64Blob(encrypted) };
    expect(() => decryptFieldDefinition(raw, otherKey)).toThrow();
  });
});

// ── decryptFieldDefinitionPage ────────────────────────────────────────

describe("decryptFieldDefinitionPage", () => {
  it("decrypts all items and passes through nextCursor", () => {
    const encrypted: FieldDefinitionEncryptedFields = {
      name: "Field A",
      description: null,
      options: null,
    };
    const raw = {
      items: [{ ...BASE_DEFINITION_RESULT, encryptedData: makeBase64Blob(encrypted) }],
      nextCursor: "cursor_abc",
    };

    const result = decryptFieldDefinitionPage(raw, masterKey);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Field A");
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("returns empty items array and null nextCursor for empty page", () => {
    const raw = { items: [], nextCursor: null };
    const result = decryptFieldDefinitionPage(raw, masterKey);
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("decrypts multiple items", () => {
    const enc1: FieldDefinitionEncryptedFields = {
      name: "Alpha",
      description: "First",
      options: null,
    };
    const enc2: FieldDefinitionEncryptedFields = {
      name: "Beta",
      description: null,
      options: ["a", "b"],
    };
    const raw = {
      items: [
        {
          ...BASE_DEFINITION_RESULT,
          id: "fld_001" as FieldDefinitionId,
          encryptedData: makeBase64Blob(enc1),
        },
        {
          ...BASE_DEFINITION_RESULT,
          id: "fld_002" as FieldDefinitionId,
          fieldType: "multi-select" as const,
          encryptedData: makeBase64Blob(enc2),
        },
      ],
      nextCursor: null,
    };

    const result = decryptFieldDefinitionPage(raw, masterKey);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.name).toBe("Alpha");
    expect(result.items[1]?.name).toBe("Beta");
    expect(result.items[1]?.options).toEqual(["a", "b"]);
  });
});

// ── encryptFieldDefinitionInput ───────────────────────────────────────

describe("encryptFieldDefinitionInput", () => {
  it("returns an object with encryptedData string", () => {
    const data: FieldDefinitionEncryptedFields = {
      name: "Height",
      description: "Member height",
      options: null,
    };

    const result = encryptFieldDefinitionInput(data, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: decryptFieldDefinition recovers original fields", () => {
    const data: FieldDefinitionEncryptedFields = {
      name: "Mood",
      description: null,
      options: ["happy", "calm", "anxious"],
    };

    const { encryptedData } = encryptFieldDefinitionInput(data, masterKey);
    const raw = { ...BASE_DEFINITION_RESULT, encryptedData };
    const result = decryptFieldDefinition(raw, masterKey);

    expect(result.name).toBe("Mood");
    expect(result.description).toBeNull();
    expect(result.options).toEqual(["happy", "calm", "anxious"]);
  });
});

// ── decryptFieldValue ─────────────────────────────────────────────────

describe("decryptFieldValue", () => {
  it("decrypts a text field value", () => {
    const encrypted = { fieldType: "text" as const, value: "they/them" };
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob(encrypted) };

    const result = decryptFieldValue(raw, masterKey);

    expect(result.id).toBe(raw.id);
    expect(result.fieldDefinitionId).toBe(raw.fieldDefinitionId);
    expect(result.memberId).toBeNull();
    expect(result.fieldType).toBe("text");
    expect(result.value).toBe("they/them");
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
  });

  it("decrypts a number field value", () => {
    const encrypted = { fieldType: "number" as const, value: 42 };
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob(encrypted) };

    const result = decryptFieldValue(raw, masterKey);
    expect(result.fieldType).toBe("number");
    expect(result.value).toBe(42);
  });

  it("decrypts a boolean field value", () => {
    const encrypted = { fieldType: "boolean" as const, value: false };
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob(encrypted) };

    const result = decryptFieldValue(raw, masterKey);
    expect(result.fieldType).toBe("boolean");
    expect(result.value).toBe(false);
  });

  it("decrypts a multi-select field value", () => {
    const encrypted = { fieldType: "multi-select" as const, value: ["host", "gatekeeper"] };
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob(encrypted) };

    const result = decryptFieldValue(raw, masterKey);
    expect(result.fieldType).toBe("multi-select");
    expect(result.value).toEqual(["host", "gatekeeper"]);
  });

  it("throws when encryptedData is invalid", () => {
    const raw = { ...BASE_VALUE_RESULT, encryptedData: "bad-data!!!" };
    expect(() => decryptFieldValue(raw, masterKey)).toThrow();
  });

  it("throws when decrypted blob payload is not a valid FieldValueUnion", () => {
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob({ unexpected: true }) };
    expect(() => decryptFieldValue(raw, masterKey)).toThrow();
  });

  it("throws when blob was encrypted with a different key", () => {
    const otherKey = generateMasterKey();
    const encrypted = { fieldType: "text" as const, value: "x" };
    const raw = { ...BASE_VALUE_RESULT, encryptedData: makeBase64Blob(encrypted) };
    expect(() => decryptFieldValue(raw, otherKey)).toThrow();
  });
});

// ── decryptFieldValueList ─────────────────────────────────────────────

describe("decryptFieldValueList", () => {
  it("decrypts all values in the list", () => {
    const enc1 = { fieldType: "text" as const, value: "Alice" };
    const enc2 = { fieldType: "number" as const, value: 30 };
    const raw = [
      { ...BASE_VALUE_RESULT, id: "fv_001" as FieldValueId, encryptedData: makeBase64Blob(enc1) },
      { ...BASE_VALUE_RESULT, id: "fv_002" as FieldValueId, encryptedData: makeBase64Blob(enc2) },
    ];

    const result = decryptFieldValueList(raw, masterKey);

    expect(result).toHaveLength(2);
    expect(result[0]?.fieldType).toBe("text");
    expect(result[0]?.value).toBe("Alice");
    expect(result[1]?.fieldType).toBe("number");
    expect(result[1]?.value).toBe(30);
  });

  it("returns empty array for empty input", () => {
    expect(decryptFieldValueList([], masterKey)).toEqual([]);
  });
});

// ── encryptFieldValueInput ────────────────────────────────────────────

describe("encryptFieldValueInput", () => {
  it("returns an object with encryptedData string", () => {
    const result = encryptFieldValueInput(
      { fieldType: "color" as const, value: "#ff5555" },
      masterKey,
    );
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: decryptFieldValue recovers original value", () => {
    const payload = { fieldType: "select" as const, value: "protector" };
    const { encryptedData } = encryptFieldValueInput(payload, masterKey);
    const raw = { ...BASE_VALUE_RESULT, encryptedData };

    const result = decryptFieldValue(raw, masterKey);
    expect(result.fieldType).toBe("select");
    expect(result.value).toBe("protector");
  });

  it("round-trips a url value", () => {
    const payload = { fieldType: "url" as const, value: "https://example.com" };
    const { encryptedData } = encryptFieldValueInput(payload, masterKey);
    const raw = { ...BASE_VALUE_RESULT, encryptedData };

    const result = decryptFieldValue(raw, masterKey);
    expect(result.fieldType).toBe("url");
    expect(result.value).toBe("https://example.com");
  });
});

// ── FieldValueDecrypted type guard ────────────────────────────────────

describe("FieldValueDecrypted shape", () => {
  it("carries all non-encrypted fields from the wire result", () => {
    const encrypted = { fieldType: "boolean" as const, value: true };
    const raw = {
      ...BASE_VALUE_RESULT,
      memberId: "mem_xyz" as import("@pluralscape/types").MemberId,
      encryptedData: makeBase64Blob(encrypted),
    };

    const result: FieldValueDecrypted = decryptFieldValue(raw, masterKey);

    expect(result.memberId).toBe("mem_xyz");
    expect(result.systemId).toBe(BASE_VALUE_RESULT.systemId);
    expect(result.groupId).toBeNull();
    expect(result.structureEntityId).toBeNull();
  });
});
