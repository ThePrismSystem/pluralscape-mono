import { brandId, toUnixMillis } from "@pluralscape/types";
import { StructureEntityEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  SystemId,
  SystemStructureEntity,
  SystemStructureEntityEncryptedInput,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  SystemStructureEntityWire,
} from "@pluralscape/types";

export interface StructureEntityPage {
  readonly data: readonly SystemStructureEntityWire[];
  readonly nextCursor: string | null;
}

export function decryptStructureEntity(
  raw: SystemStructureEntityWire,
  masterKey: KdfMasterKey,
): SystemStructureEntity | Archived<SystemStructureEntity> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = StructureEntityEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<SystemStructureEntityId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    entityTypeId: brandId<SystemStructureEntityTypeId>(raw.entityTypeId),
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    description: validated.description,
    emoji: validated.emoji,
    color: validated.color,
    imageSource: validated.imageSource,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived structureEntity missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
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
  data: SystemStructureEntityEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityUpdate(
  data: SystemStructureEntityEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
