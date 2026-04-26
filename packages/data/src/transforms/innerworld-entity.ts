import { brandId, toUnixMillis } from "@pluralscape/types";
import { InnerWorldEntityEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  InnerWorldEntity,
  InnerWorldEntityEncryptedInput,
  InnerWorldEntityId,
  InnerWorldEntityWire,
  InnerWorldRegionId,
  SystemId,
} from "@pluralscape/types";

export interface InnerWorldEntityPage {
  readonly data: readonly InnerWorldEntityWire[];
  readonly nextCursor: string | null;
}

export function decryptInnerWorldEntity(
  raw: InnerWorldEntityWire,
  masterKey: KdfMasterKey,
): InnerWorldEntity | Archived<InnerWorldEntity> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = InnerWorldEntityEncryptedInputSchema.parse(decrypted);

  const shared = {
    id: brandId<InnerWorldEntityId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    regionId: raw.regionId === null ? null : brandId<InnerWorldRegionId>(raw.regionId),
    positionX: validated.positionX,
    positionY: validated.positionY,
    visual: validated.visual,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  const variant: InnerWorldEntity =
    validated.entityType === "member"
      ? {
          ...shared,
          entityType: "member",
          linkedMemberId: validated.linkedMemberId,
          archived: false,
        }
      : validated.entityType === "landmark"
        ? {
            ...shared,
            entityType: "landmark",
            name: validated.name,
            description: validated.description,
            archived: false,
          }
        : {
            ...shared,
            entityType: "structure-entity",
            linkedStructureEntityId: validated.linkedStructureEntityId,
            archived: false,
          };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived innerworldEntity missing archivedAt");
    return {
      ...variant,
      archived: true as const,
      archivedAt: toUnixMillis(raw.archivedAt),
    } as Archived<InnerWorldEntity>;
  }
  return variant;
}

export function decryptInnerWorldEntityPage(
  raw: InnerWorldEntityPage,
  masterKey: KdfMasterKey,
): {
  data: (InnerWorldEntity | Archived<InnerWorldEntity>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptInnerWorldEntity(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptInnerWorldEntityInput(
  data: InnerWorldEntityEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptInnerWorldEntityUpdate(
  data: InnerWorldEntityEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
