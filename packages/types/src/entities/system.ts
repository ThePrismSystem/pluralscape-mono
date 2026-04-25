import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AccountId, SystemId, SystemSettingsId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

/** A plural system — the top-level account entity. */
export interface System extends AuditMetadata {
  readonly id: SystemId;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly avatarSource: ImageSource | null;
  readonly settingsId: SystemSettingsId;
}

/**
 * Keys of `System` that are encrypted client-side before the server sees
 * them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextSystem parity)
 * - `SystemServerMetadata` (derived via `Omit`)
 */
export type SystemEncryptedFields = "name" | "displayName" | "description" | "avatarSource";

/**
 * Pre-encryption shape — what `encryptSystemInput` accepts. Single source
 * of truth: derived from `System` via `Pick<>` over the encrypted-keys union.
 */
export type SystemEncryptedInput = Pick<System, SystemEncryptedFields>;

/** @future Multi-system switcher list item — not yet implemented. */
export interface SystemListItem {
  readonly id: SystemId;
  readonly name: string;
  readonly avatarSource: ImageSource | null;
}

/**
 * Server-visible System metadata — raw Drizzle row shape.
 *
 * Derived from `System` by stripping the encrypted field keys (bundled
 * inside `encryptedData`) and `settingsId` (which lives on the companion
 * `system_settings` table, joined on `systemId`, not as a column on
 * `systems`). Adds the DB-only columns the domain type doesn't carry:
 * `accountId` (owning account FK), `encryptedData` (nullable — the system
 * row can exist in onboarding before a T1 blob is written), and
 * `archived`/`archivedAt` (archivable metadata).
 */
export type SystemServerMetadata = Omit<System, SystemEncryptedFields | "settingsId"> & {
  readonly accountId: AccountId;
  readonly encryptedData: EncryptedBlob | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/**
 * Server-emit shape — what `toSystemResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type SystemResult = EncryptedWire<SystemServerMetadata>;

/**
 * JSON-serialized wire form of `SystemResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type SystemWire = Serialize<SystemResult>;
