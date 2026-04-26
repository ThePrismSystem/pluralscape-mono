import { brandId, toUnixMillis } from "@pluralscape/types";
import { CustomFrontEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CustomFront,
  CustomFrontEncryptedInput,
  CustomFrontId,
  CustomFrontWire,
  SystemId,
} from "@pluralscape/types";

export interface CustomFrontPage {
  readonly data: readonly CustomFrontWire[];
  readonly nextCursor: string | null;
}

export function decryptCustomFront(
  raw: CustomFrontWire,
  masterKey: KdfMasterKey,
): CustomFront | Archived<CustomFront> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = CustomFrontEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<CustomFrontId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    description: validated.description,
    color: validated.color,
    emoji: validated.emoji,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived custom front missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptCustomFrontPage(
  raw: CustomFrontPage,
  masterKey: KdfMasterKey,
): { data: (CustomFront | Archived<CustomFront>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptCustomFront(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptCustomFrontInput(
  data: CustomFrontEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptCustomFrontUpdate(
  data: CustomFrontEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
