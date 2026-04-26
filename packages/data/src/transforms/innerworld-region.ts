import { brandId, toUnixMillis } from "@pluralscape/types";
import { InnerWorldRegionEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  InnerWorldRegion,
  InnerWorldRegionEncryptedInput,
  InnerWorldRegionId,
  InnerWorldRegionWire,
  SystemId,
} from "@pluralscape/types";

export interface InnerWorldRegionPage {
  readonly data: readonly InnerWorldRegionWire[];
  readonly nextCursor: string | null;
}

export function decryptInnerWorldRegion(
  raw: InnerWorldRegionWire,
  masterKey: KdfMasterKey,
): InnerWorldRegion | Archived<InnerWorldRegion> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = InnerWorldRegionEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<InnerWorldRegionId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    parentRegionId:
      raw.parentRegionId === null ? null : brandId<InnerWorldRegionId>(raw.parentRegionId),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    description: validated.description,
    boundaryData: validated.boundaryData,
    visual: validated.visual,
    gatekeeperMemberIds: validated.gatekeeperMemberIds,
    accessType: validated.accessType,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived innerworldRegion missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptInnerWorldRegionPage(
  raw: InnerWorldRegionPage,
  masterKey: KdfMasterKey,
): {
  data: (InnerWorldRegion | Archived<InnerWorldRegion>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptInnerWorldRegion(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptInnerWorldRegionInput(
  data: InnerWorldRegionEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptInnerWorldRegionUpdate(
  data: InnerWorldRegionEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
