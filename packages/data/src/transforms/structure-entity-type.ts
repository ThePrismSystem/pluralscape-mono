import { StructureEntityTypeEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/**
 * Shape passed to `encryptStructureEntityTypeInput()` before encryption.
 * Derived from the `SystemStructureEntityType` domain type by picking the
 * encrypted-field keys — single source of truth lives in `@pluralscape/types`.
 */
export type StructureEntityTypeEncryptedInput = Pick<
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields
>;

/** Wire shape returned by `structureEntityType.get` — derived from the domain. */
export type StructureEntityTypeRaw = Omit<
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface StructureEntityTypePage {
  readonly data: readonly StructureEntityTypeRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Decrypt a single structure entity type wire object to the canonical domain
 * type. Passthrough fields (id, systemId, sortOrder, archived, version,
 * createdAt, updatedAt) are copied directly; encrypted fields are decrypted
 * from encryptedData and validated by `StructureEntityTypeEncryptedInputSchema`.
 */
export function decryptStructureEntityType(
  raw: StructureEntityTypeRaw,
  masterKey: KdfMasterKey,
): SystemStructureEntityType | Archived<SystemStructureEntityType> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = StructureEntityTypeEncryptedInputSchema.parse(decrypted);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: validated.name,
    description: validated.description,
    emoji: validated.emoji,
    color: validated.color,
    imageSource: validated.imageSource,
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived structureEntityType missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptStructureEntityTypePage(
  raw: StructureEntityTypePage,
  masterKey: KdfMasterKey,
): {
  data: (SystemStructureEntityType | Archived<SystemStructureEntityType>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptStructureEntityType(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptStructureEntityTypeInput(
  data: StructureEntityTypeEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityTypeUpdate(
  data: StructureEntityTypeEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
