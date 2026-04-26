import { brandId, toUnixMillis } from "@pluralscape/types";
import { StructureEntityTypeEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  SystemId,
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedInput,
  SystemStructureEntityTypeId,
  SystemStructureEntityTypeWire,
} from "@pluralscape/types";

export interface StructureEntityTypePage {
  readonly data: readonly SystemStructureEntityTypeWire[];
  readonly nextCursor: string | null;
}

export function decryptStructureEntityType(
  raw: SystemStructureEntityTypeWire,
  masterKey: KdfMasterKey,
): SystemStructureEntityType | Archived<SystemStructureEntityType> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = StructureEntityTypeEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<SystemStructureEntityTypeId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
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
    if (raw.archivedAt === null) throw new Error("Archived structureEntityType missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
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
  data: SystemStructureEntityTypeEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptStructureEntityTypeUpdate(
  data: SystemStructureEntityTypeEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
