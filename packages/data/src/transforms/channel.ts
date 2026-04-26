import { brandId, toUnixMillis } from "@pluralscape/types";
import { ChannelEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  Channel,
  ChannelEncryptedInput,
  ChannelId,
  ChannelWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `channel.list`. */
export interface ChannelPage {
  readonly data: readonly ChannelWire[];
  readonly nextCursor: string | null;
}

export function decryptChannel(
  raw: ChannelWire,
  masterKey: KdfMasterKey,
): Channel | Archived<Channel> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = ChannelEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<ChannelId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    name: validated.name,
    type: raw.type,
    parentId: raw.parentId === null ? null : brandId<ChannelId>(raw.parentId),
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived channel missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptChannelPage(
  raw: ChannelPage,
  masterKey: KdfMasterKey,
): { data: (Channel | Archived<Channel>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptChannel(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptChannelInput(
  data: ChannelEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptChannelUpdate(
  data: ChannelEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
