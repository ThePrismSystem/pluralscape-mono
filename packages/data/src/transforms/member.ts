import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { Archived, Member } from "@pluralscape/types";

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
}

// ── Member transforms ────────────────────────────────────────────────

/**
 * Decrypt a single member wire object to the canonical domain type.
 *
 * Passthrough fields (id, systemId, archived, version, createdAt, updatedAt)
 * are copied directly; all other fields are decrypted from encryptedData.
 */
export function decryptMember(
  raw: ServerMember,
  masterKey: KdfMasterKey,
): Member | Archived<Member> {
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
  raw: { data: readonly ServerMember[]; nextCursor: string | null },
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
