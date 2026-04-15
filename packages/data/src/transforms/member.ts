import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, Member, UnixMillis } from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `member.get` — derived from the `Member` domain type. */
export type MemberRaw = Omit<Member, keyof MemberEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `member.list`. */
export interface MemberPage {
  readonly data: readonly MemberRaw[];
  readonly nextCursor: string | null;
}

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

/** Compile-time check: encrypted fields must be a subset of the domain type. */
export type AssertMemberFieldsSubset =
  MemberEncryptedFields extends Pick<Member, keyof MemberEncryptedFields> ? true : never;

// ── Validator ─────────────────────────────────────────────────────────

function assertMemberEncryptedFields(raw: unknown): asserts raw is MemberEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted member blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["name"] !== "string") {
    throw new Error("Decrypted member blob missing required string field: name");
  }
  if (!Array.isArray(obj["pronouns"])) {
    throw new Error("Decrypted member blob missing required array field: pronouns");
  }
  if (obj["description"] !== null && typeof obj["description"] !== "string") {
    throw new Error("Decrypted member blob: description must be string or null");
  }
  if (typeof obj["suppressFriendFrontNotification"] !== "boolean") {
    throw new Error(
      "Decrypted member blob missing required boolean field: suppressFriendFrontNotification",
    );
  }
  if (typeof obj["boardMessageNotificationOnFront"] !== "boolean") {
    throw new Error(
      "Decrypted member blob missing required boolean field: boardMessageNotificationOnFront",
    );
  }
  if (obj["avatarSource"] === undefined) {
    throw new Error("Decrypted member blob missing field: avatarSource");
  }
  if (obj["colors"] === undefined) {
    throw new Error("Decrypted member blob missing field: colors");
  }
  if (obj["saturationLevel"] === undefined) {
    throw new Error("Decrypted member blob missing field: saturationLevel");
  }
  if (!Array.isArray(obj["tags"])) {
    throw new Error("Decrypted member blob missing required array field: tags");
  }
}

// ── Member transforms ────────────────────────────────────────────────

/**
 * Decrypt a single member wire object to the canonical domain type.
 *
 * Passthrough fields (id, systemId, archived, version, createdAt, updatedAt)
 * are copied directly; all other fields are decrypted from encryptedData.
 */
export function decryptMember(raw: MemberRaw, masterKey: KdfMasterKey): Member | Archived<Member> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertMemberEncryptedFields(decrypted);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
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
  data: MemberEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt member fields for an update mutation, including the version for optimistic locking.
 */
export function encryptMemberUpdate(
  data: MemberEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
