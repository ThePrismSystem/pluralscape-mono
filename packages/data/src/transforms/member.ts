import { brandId, toUnixMillis } from "@pluralscape/types";
import { MemberEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  Member,
  MemberEncryptedInput,
  MemberId,
  MemberWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `member.list`. */
export interface MemberPage {
  readonly data: readonly MemberWire[];
  readonly nextCursor: string | null;
}

// ── Member transforms ────────────────────────────────────────────────

/**
 * Decrypt a single member wire object to the canonical domain type.
 *
 * Passthrough fields (id, systemId, archived, version, createdAt, updatedAt)
 * are re-branded from the JSON-wire shape (where `Serialize<>` strips brands
 * and timestamps to plain primitives) back into the canonical branded
 * domain types; all encrypted fields are decrypted from `encryptedData`
 * and validated by `MemberEncryptedInputSchema`.
 */
export function decryptMember(raw: MemberWire, masterKey: KdfMasterKey): Member | Archived<Member> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = MemberEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<MemberId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    name: validated.name,
    pronouns: validated.pronouns,
    description: validated.description,
    avatarSource: validated.avatarSource,
    colors: validated.colors,
    saturationLevel: validated.saturationLevel,
    tags: validated.tags,
    suppressFriendFrontNotification: validated.suppressFriendFrontNotification,
    boardMessageNotificationOnFront: validated.boardMessageNotificationOnFront,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived member missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated list of member wire objects.
 */
export function decryptMemberPage(
  raw: MemberPage,
  masterKey: KdfMasterKey,
): { data: (Member | Archived<Member>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptMember(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt member fields for a create mutation.
 */
export function encryptMemberInput(
  data: MemberEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt member fields for an update mutation, including the version for optimistic locking.
 */
export function encryptMemberUpdate(
  data: MemberEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
