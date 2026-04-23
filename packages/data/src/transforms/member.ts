import { MemberEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, Member, MemberEncryptedFields, UnixMillis } from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `member.get` — derived from the `Member` domain type. */
export type MemberRaw = Omit<Member, MemberEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `member.list`. */
export interface MemberPage {
  readonly data: readonly MemberRaw[];
  readonly nextCursor: string | null;
}

/**
 * Shape passed to `encryptMemberInput()` before encryption. Derived from the
 * `Member` domain type by picking the encrypted-field keys — single source
 * of truth lives in `@pluralscape/types`.
 */
export type MemberEncryptedInput = Pick<Member, MemberEncryptedFields>;

// ── Member transforms ────────────────────────────────────────────────

/**
 * Decrypt a single member wire object to the canonical domain type.
 *
 * Passthrough fields (id, systemId, archived, version, createdAt, updatedAt)
 * are copied directly; all other fields are decrypted from encryptedData and
 * validated by `MemberEncryptedInputSchema`.
 */
export function decryptMember(raw: MemberRaw, masterKey: KdfMasterKey): Member | Archived<Member> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = MemberEncryptedInputSchema.parse(decrypted);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
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
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
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
