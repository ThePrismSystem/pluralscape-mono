import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  FieldDefinitionId,
  FieldType,
  FieldValueId,
  FieldValueUnion,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `field.definition.get` and `field.definition.list` items. */
interface FieldDefinitionRaw {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

/** Shape returned by `field.definition.list`. */
interface FieldDefinitionPage {
  readonly items: readonly FieldDefinitionRaw[];
  readonly nextCursor: string | null;
}

/** Shape returned by `field.value.list` and `field.value.set`. */
interface FieldValueRaw {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a field definition blob.
 * Pass this to `encryptFieldDefinitionInput` when creating or updating a definition.
 */
export interface FieldDefinitionEncryptedFields {
  readonly name: string;
  readonly description: string | null;
  /** Valid options for select / multi-select fields. Null for other types. */
  readonly options: readonly string[] | null;
}

// ── Decrypted output types ────────────────────────────────────────────

/** A fully decrypted field definition, combining wire metadata with plaintext fields. */
export interface FieldDefinitionDecrypted {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly fieldType: FieldType;
  readonly options: readonly string[] | null;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/**
 * A fully decrypted field value, combining wire metadata with the decrypted value union.
 * `fieldType` and `value` are decrypted from the encrypted blob.
 */
export type FieldValueDecrypted = {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly systemId: SystemId;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
} & FieldValueUnion;

// ── Validators ────────────────────────────────────────────────────────

const VALID_FIELD_TYPES = new Set<string>([
  "text",
  "number",
  "boolean",
  "date",
  "color",
  "select",
  "multi-select",
  "url",
]);

function assertFieldDefinitionEncryptedFields(
  raw: unknown,
): asserts raw is FieldDefinitionEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted field definition blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["name"] !== "string") {
    throw new Error("Decrypted field definition blob missing required string field: name");
  }
  if (obj["description"] !== null && typeof obj["description"] !== "string") {
    throw new Error("Decrypted field definition blob: description must be string or null");
  }
  if (obj["options"] !== null) {
    if (!Array.isArray(obj["options"])) {
      throw new Error("Decrypted field definition blob: options must be string[] or null");
    }
    for (const opt of obj["options"] as unknown[]) {
      if (typeof opt !== "string") {
        throw new Error("Decrypted field definition blob: each option must be a string");
      }
    }
  }
}

function assertFieldValueUnion(raw: unknown): asserts raw is FieldValueUnion {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted field value blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["fieldType"] !== "string" || !VALID_FIELD_TYPES.has(obj["fieldType"])) {
    throw new Error(
      `Decrypted field value blob has invalid fieldType: ${String(obj["fieldType"])}`,
    );
  }
  if (!("value" in obj)) {
    throw new Error("Decrypted field value blob missing required field: value");
  }
}

// ── Field Definition transforms ───────────────────────────────────────

/**
 * Decrypt a single field definition API result into a `FieldDefinitionDecrypted`.
 *
 * The encrypted blob contains: `name`, `description`, `options`.
 * All other fields pass through from the wire payload.
 */
export function decryptFieldDefinition(
  raw: FieldDefinitionRaw,
  masterKey: KdfMasterKey,
): FieldDefinitionDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFieldDefinitionEncryptedFields(plaintext);
  return {
    id: raw.id,
    systemId: raw.systemId,
    name: plaintext.name,
    description: plaintext.description,
    fieldType: raw.fieldType,
    options: plaintext.options,
    required: raw.required,
    sortOrder: raw.sortOrder,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated field definition list result.
 *
 * Returns `{ items: FieldDefinitionDecrypted[]; nextCursor: string | null }`.
 */
export function decryptFieldDefinitionPage(
  raw: FieldDefinitionPage,
  masterKey: KdfMasterKey,
): { items: FieldDefinitionDecrypted[]; nextCursor: string | null } {
  return {
    items: raw.items.map((item) => decryptFieldDefinition(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt field definition plaintext fields for create / update payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateFieldDefinitionBodySchema` or `UpdateFieldDefinitionBodySchema`.
 */
export function encryptFieldDefinitionInput(
  data: FieldDefinitionEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

// ── Field Value transforms ────────────────────────────────────────────

/**
 * Decrypt a single field value API result into a `FieldValueDecrypted`.
 *
 * The encrypted blob contains the full `FieldValueUnion` (`fieldType` + `value`).
 * All other fields pass through from the wire payload.
 */
export function decryptFieldValue(
  raw: FieldValueRaw,
  masterKey: KdfMasterKey,
): FieldValueDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFieldValueUnion(plaintext);
  return {
    id: raw.id,
    fieldDefinitionId: raw.fieldDefinitionId,
    memberId: raw.memberId,
    structureEntityId: raw.structureEntityId,
    groupId: raw.groupId,
    systemId: raw.systemId,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    fieldType: plaintext.fieldType,
    value: plaintext.value,
  } as FieldValueDecrypted;
}

/**
 * Decrypt a list of field value API results.
 *
 * Returns `FieldValueDecrypted[]` — the full list from `field.value.list`.
 */
export function decryptFieldValueList(
  raw: readonly FieldValueRaw[],
  masterKey: KdfMasterKey,
): FieldValueDecrypted[] {
  return raw.map((item) => decryptFieldValue(item, masterKey));
}

/**
 * Encrypt a field value union for set / update payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `SetFieldValueBodySchema` or `UpdateFieldValueBodySchema`.
 */
export function encryptFieldValueInput(
  data: FieldValueUnion,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}
