import { brandId } from "@pluralscape/types";
import { RelationshipEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  MemberId,
  Relationship,
  RelationshipEncryptedFields,
  RelationshipId,
  RelationshipType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

/**
 * Shape passed to `encryptRelationshipInput()` / `encryptRelationshipUpdate()`
 * before encryption. Derived from the `Relationship` domain type by picking
 * the encrypted-field keys — single source of truth lives in
 * `@pluralscape/types`.
 */
export type RelationshipEncryptedInput = Pick<Relationship, RelationshipEncryptedFields>;

export interface RelationshipDecrypted {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly type: RelationshipType;
  readonly label: string | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: false;
}

export type RelationshipRaw = Omit<
  RelationshipDecrypted,
  RelationshipEncryptedFields | "archived" | "sourceMemberId" | "targetMemberId"
> & {
  readonly sourceMemberId: string | null;
  readonly targetMemberId: string | null;
  readonly encryptedData: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface RelationshipPage {
  readonly data: readonly RelationshipRaw[];
  readonly nextCursor: string | null;
}

export function decryptRelationship(
  raw: RelationshipRaw,
  masterKey: KdfMasterKey,
): RelationshipDecrypted | Archived<RelationshipDecrypted> {
  let label: string | null = null;
  if (raw.encryptedData !== null) {
    const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
    const validated = RelationshipEncryptedInputSchema.parse(plaintext);
    label = validated.label;
  }

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    sourceMemberId: raw.sourceMemberId ? brandId<MemberId>(raw.sourceMemberId) : null,
    targetMemberId: raw.targetMemberId ? brandId<MemberId>(raw.targetMemberId) : null,
    type: raw.type,
    label,
    bidirectional: raw.bidirectional,
    createdAt: raw.createdAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived relationship missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptRelationshipPage(
  raw: RelationshipPage,
  masterKey: KdfMasterKey,
): {
  data: (RelationshipDecrypted | Archived<RelationshipDecrypted>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptRelationship(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptRelationshipInput(
  data: RelationshipEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptRelationshipUpdate(
  data: RelationshipEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
