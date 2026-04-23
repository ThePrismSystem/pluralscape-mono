import {
  FieldDefinitionEncryptedInputSchema,
  FieldValueEncryptedInputSchema,
} from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldDefinitionId,
  FieldType,
  FieldValueEncryptedFields,
  FieldValueId,
  FieldValueUnion,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a field definition blob. Derived
 * from the `FieldDefinition` domain type by picking the encrypted-field
 * keys — single source of truth lives in `@pluralscape/types`.
 */
export type FieldDefinitionEncryptedInput = Pick<FieldDefinition, FieldDefinitionEncryptedFields>;

/**
 * The plaintext payload encrypted inside a field value blob — the
 * discriminated `FieldValueUnion` travels whole (both `fieldType` and
 * `value`), distinct from the `FieldValueEncryptedFields = "value"`
 * union which only captures the outer key on the domain type.
 */
export type FieldValueEncryptedInput = FieldValueUnion;

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

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `field.definition.get` — derived from `FieldDefinitionDecrypted`. */
export type FieldDefinitionRaw = Omit<
  FieldDefinitionDecrypted,
  keyof Pick<FieldDefinition, FieldDefinitionEncryptedFields>
> & {
  readonly encryptedData: string;
};

/** Shape returned by `field.definition.list`. */
export interface FieldDefinitionPage {
  readonly data: readonly FieldDefinitionRaw[];
  readonly nextCursor: string | null;
}

/** Wire shape returned by `field.value.list` — derived from `FieldValueDecrypted`. */
export type FieldValueRaw = Omit<FieldValueDecrypted, keyof FieldValueUnion | FieldValueEncryptedFields> & {
  readonly encryptedData: string;
};

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
  const validated = FieldDefinitionEncryptedInputSchema.parse(plaintext);
  return {
    id: raw.id,
    systemId: raw.systemId,
    name: validated.name,
    description: validated.description,
    fieldType: raw.fieldType,
    options: validated.options,
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
 */
export function decryptFieldDefinitionPage(
  raw: FieldDefinitionPage,
  masterKey: KdfMasterKey,
): { data: FieldDefinitionDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptFieldDefinition(item, masterKey)),
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
  data: FieldDefinitionEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
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
  const validated = FieldValueEncryptedInputSchema.parse(plaintext);
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
    ...validated,
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
  data: FieldValueEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}
