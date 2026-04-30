/**
 * Sync and document const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import {
  type DocumentKeyType,
  type PKSyncDirection,
  type SyncDocumentType,
} from "@pluralscape/types";

export const SYNC_DOC_TYPES = [
  "system-core",
  "fronting",
  "chat",
  "note",
  "journal",
  "privacy-config",
  "bucket",
] as const satisfies readonly SyncDocumentType[];

export const SYNC_KEY_TYPES = ["derived", "bucket"] as const satisfies readonly DocumentKeyType[];

export const PK_SYNC_DIRECTIONS = [
  "ps-to-pk",
  "pk-to-ps",
  "bidirectional",
] as const satisfies readonly PKSyncDirection[];
