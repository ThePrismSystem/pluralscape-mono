import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  FieldDefinitionId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { Serialize } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

/** Discriminated union of typed field values. */
export type FieldValueUnion =
  | { readonly fieldType: "text"; readonly value: string }
  | { readonly fieldType: "number"; readonly value: number }
  | { readonly fieldType: "boolean"; readonly value: boolean }
  | { readonly fieldType: "date"; readonly value: string }
  | { readonly fieldType: "color"; readonly value: string }
  | { readonly fieldType: "select"; readonly value: string }
  | { readonly fieldType: "multi-select"; readonly value: readonly string[] }
  | { readonly fieldType: "url"; readonly value: string };

/** A value stored for a specific field on an entity. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly value: FieldValueUnion;
}

/**
 * Keys of `FieldValue` that are encrypted client-side before the server sees
 * them. The encrypted payload carries the `value` discriminated union
 * (`FieldValueUnion` — `{fieldType, value}`), so only `value` rides encrypted.
 * Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextFieldValue parity)
 * - `FieldValueServerMetadata` (derived via `Omit`)
 * - `FieldValueEncryptedInput` in `packages/data` (derived via `Pick`)
 */
export type FieldValueEncryptedFields = "value";

/**
 * Pre-encryption shape — what `encryptFieldValueInput` accepts. Single source
 * of truth: derived from `FieldValue` via `Pick<>` over the encrypted-keys union.
 */
export type FieldValueEncryptedInput = Pick<FieldValue, FieldValueEncryptedFields>;

/**
 * Server-visible FieldValue metadata — raw Drizzle row shape.
 *
 * Derived from `FieldValue` by stripping the encrypted `value` discriminated
 * union (its payload rides inside `encryptedData`). Adds the DB-only
 * `systemId` column — the domain type keeps scope through the parent
 * `FieldDefinition`, but the row denormalises `systemId` for multi-column
 * FKs and RLS scoping. FieldValue has no `archived` column.
 */
export type FieldValueServerMetadata = Omit<FieldValue, FieldValueEncryptedFields> & {
  readonly systemId: SystemId;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toFieldValueResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type FieldValueResult = EncryptedWire<FieldValueServerMetadata>;

/**
 * JSON-serialized wire form of `FieldValueResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type FieldValueWire = Serialize<FieldValueResult>;
