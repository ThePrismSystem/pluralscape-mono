import { StructureEntityEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/**
 * Shape passed to `encryptStructureEntityInput()` before encryption.
 * Derived from the `SystemStructureEntity` domain type by picking the
 * encrypted-field keys — single source of truth lives in `@pluralscape/types`.
 */
export type StructureEntityEncryptedInput = Pick<
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields
>;

/** Wire shape returned by `structureEntity.get` — derived from the domain. */
export type StructureEntityRaw = Omit<
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields | "archived"
> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface StructureEntityPage {
  readonly data: readonly StructureEntityRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Decrypt a single structure entity wire object to the canonical domain type.
 * Passthrough fields (id, systemId, entityTypeId, sortOrder, archived,
 * version, createdAt, updatedAt) are copied directly; encrypted fields are
 * decrypted from encryptedData and validated by
 * `StructureEntityEncryptedInputSchema`.
 */
export function decryptStructureEntity(
  raw: StructureEntityRaw,
  masterKey: KdfMasterKey,
): SystemStructureEntity | Archived<SystemStructureEntity> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = StructureEntityEncryptedInputSchema.parse(decrypted);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    entityTypeId: raw.entityTypeId,
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
    if (raw.archivedAt === null) throw new Error("Archived structureEntity missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptStructureEntityPage(
  raw: StructureEntityPage,
  masterKey: KdfMasterKey,
): {
  data: (SystemStructureEntity | Archived<SystemStructureEntity>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptStructureEntity(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptStructureEntityInput(
  data: StructureEntityEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityUpdate(
  data: StructureEntityEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
