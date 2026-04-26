import { brandId, toUnixMillis } from "@pluralscape/types";
import {
  CustomRelationshipEncryptedSchema,
  StandardRelationshipEncryptedSchema,
} from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  MemberId,
  Relationship,
  RelationshipEncryptedInput,
  RelationshipId,
  RelationshipWire,
  SystemId,
} from "@pluralscape/types";

export interface RelationshipPage {
  readonly data: readonly RelationshipWire[];
  readonly nextCursor: string | null;
}

export function decryptRelationship(
  raw: RelationshipWire,
  masterKey: KdfMasterKey,
): Relationship | Archived<Relationship> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);

  const baseShared = {
    id: brandId<RelationshipId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    sourceMemberId: raw.sourceMemberId === null ? null : brandId<MemberId>(raw.sourceMemberId),
    targetMemberId: raw.targetMemberId === null ? null : brandId<MemberId>(raw.targetMemberId),
    bidirectional: raw.bidirectional,
    createdAt: toUnixMillis(raw.createdAt),
  };

  // `type` is plaintext on the wire — use it to select the correct schema for
  // the decrypted blob. Custom carries `{ label }`, standard carries `{}`.
  let domainObj: Relationship;
  if (raw.type === "custom") {
    const validated = CustomRelationshipEncryptedSchema.parse(decrypted);
    domainObj = {
      ...baseShared,
      type: "custom" as const,
      label: validated.label,
      archived: false as const,
    };
  } else {
    StandardRelationshipEncryptedSchema.parse(decrypted);
    domainObj = { ...baseShared, type: raw.type, archived: false as const };
  }

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived relationship missing archivedAt");
    return { ...domainObj, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return domainObj;
}

export function decryptRelationshipPage(
  raw: RelationshipPage,
  masterKey: KdfMasterKey,
): {
  data: (Relationship | Archived<Relationship>)[];
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
