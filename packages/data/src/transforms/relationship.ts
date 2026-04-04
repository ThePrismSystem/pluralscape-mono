import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  MemberId,
  RelationshipId,
  RelationshipType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface RelationshipEncryptedFields {
  readonly label: string;
}

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
  keyof RelationshipEncryptedFields | "archived"
> & {
  readonly encryptedData: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export interface RelationshipPage {
  readonly data: readonly RelationshipRaw[];
  readonly nextCursor: string | null;
}

function assertRelationshipEncryptedFields(
  raw: unknown,
): asserts raw is RelationshipEncryptedFields {
  const obj = assertObjectBlob(raw, "relationship");
  assertStringField(obj, "relationship", "label");
}

export function decryptRelationship(
  raw: RelationshipRaw,
  masterKey: KdfMasterKey,
): RelationshipDecrypted | Archived<RelationshipDecrypted> {
  let label: string | null = null;
  if (raw.encryptedData !== null) {
    const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
    assertRelationshipEncryptedFields(plaintext);
    label = plaintext.label;
  }

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    sourceMemberId: raw.sourceMemberId,
    targetMemberId: raw.targetMemberId,
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
  data: RelationshipEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptRelationshipUpdate(
  data: RelationshipEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
