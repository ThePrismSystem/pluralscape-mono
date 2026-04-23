import type { SystemId, SystemSettingsId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
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
 * - Plan 2 fleet will consume when deriving `SystemServerMetadata`.
 */
export type SystemEncryptedFields = "name" | "displayName" | "description" | "avatarSource";

/** @future Multi-system switcher list item — not yet implemented. */
export interface SystemListItem {
  readonly id: SystemId;
  readonly name: string;
  readonly avatarSource: ImageSource | null;
}
