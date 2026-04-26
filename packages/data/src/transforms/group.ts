import { brandId, toUnixMillis } from "@pluralscape/types";
import { GroupEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  Group,
  GroupEncryptedInput,
  GroupId,
  GroupWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `group.list`. */
export interface GroupPage {
  readonly data: readonly GroupWire[];
  readonly nextCursor: string | null;
}

export function decryptGroup(raw: GroupWire, masterKey: KdfMasterKey): Group | Archived<Group> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = GroupEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<GroupId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    parentGroupId: raw.parentGroupId === null ? null : brandId<GroupId>(raw.parentGroupId),
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    description: validated.description,
    imageSource: validated.imageSource,
    color: validated.color,
    emoji: validated.emoji,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived group missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptGroupPage(
  raw: GroupPage,
  masterKey: KdfMasterKey,
): { data: (Group | Archived<Group>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptGroup(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptGroupInput(
  data: GroupEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptGroupUpdate(
  data: GroupEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
