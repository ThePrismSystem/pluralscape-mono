import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Member } from "@pluralscape/types";

type ServerMember = RouterOutput["member"]["get"];

/** The subset of Member fields stored encrypted on the server. */
export interface MemberEncryptedFields {
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly avatarSource: Member["avatarSource"];
  readonly colors: Member["colors"];
  readonly saturationLevel: Member["saturationLevel"];
  readonly tags: readonly Member["tags"][number][];
  readonly suppressFriendFrontNotification: boolean;
  readonly boardMessageNotificationOnFront: boolean;
}

/**
 * Decrypt a single member wire object to the canonical domain type.
 *
 * Passthrough fields (id, systemId, archived, version, createdAt, updatedAt)
 * are copied directly; all other fields are decrypted from encryptedData.
 */
export function decryptMember(raw: ServerMember, masterKey: KdfMasterKey): Member {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey) as MemberEncryptedFields;
  return {
    id: raw.id,
    systemId: raw.systemId,
    archived: raw.archived as false,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    name: decrypted.name,
    pronouns: decrypted.pronouns,
    description: decrypted.description,
    avatarSource: decrypted.avatarSource,
    colors: decrypted.colors,
    saturationLevel: decrypted.saturationLevel,
    tags: decrypted.tags,
    suppressFriendFrontNotification: decrypted.suppressFriendFrontNotification,
    boardMessageNotificationOnFront: decrypted.boardMessageNotificationOnFront,
  };
}

/**
 * Decrypt a paginated list of member wire objects.
 */
export function decryptMemberPage(
  raw: { items: readonly ServerMember[]; nextCursor: string | null },
  masterKey: KdfMasterKey,
): { items: Member[]; nextCursor: string | null } {
  return {
    items: raw.items.map((item) => decryptMember(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt member fields for a create mutation.
 */
export function encryptMemberInput(
  data: MemberEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

/**
 * Encrypt member fields for an update mutation, including the version for optimistic locking.
 */
export function encryptMemberUpdate(
  data: MemberEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}
