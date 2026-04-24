import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { fieldValues } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq, type SQL } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import {
  assertGroupActive,
  assertMemberActive,
  assertStructureEntityActive,
} from "../../lib/member-helpers.js";
import { MAX_ENCRYPTED_FIELD_VALUE_BYTES } from "../field-value.constants.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  FieldDefinitionId,
  FieldValueId,
  FieldValueServerMetadata,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Owner discriminated union ──────────────────────────────────────

export type FieldValueOwner =
  | { readonly kind: "member"; readonly id: MemberId }
  | { readonly kind: "group"; readonly id: GroupId }
  | { readonly kind: "structureEntity"; readonly id: SystemStructureEntityId };

// ── Types ───────────────────────────────────────────────────────────

export type FieldValueResult = EncryptedWire<FieldValueServerMetadata>;

// ── Internal helpers ───────────────────────────────────────────────

export function toFieldValueResult(row: {
  id: string;
  fieldDefinitionId: string;
  memberId: string | null;
  structureEntityId: string | null;
  groupId: string | null;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): FieldValueResult {
  return {
    id: brandId<FieldValueId>(row.id),
    fieldDefinitionId: brandId<FieldDefinitionId>(row.fieldDefinitionId),
    memberId: row.memberId ? brandId<MemberId>(row.memberId) : null,
    structureEntityId: row.structureEntityId
      ? brandId<SystemStructureEntityId>(row.structureEntityId)
      : null,
    groupId: row.groupId ? brandId<GroupId>(row.groupId) : null,
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

export function parseAndValidateValueBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_FIELD_VALUE_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_FIELD_VALUE_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

/** Assert the owner entity is active and return the column assignments for the insert. */
export async function assertOwnerActiveAndGetColumns(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  owner: FieldValueOwner,
): Promise<{
  memberId: MemberId | undefined;
  groupId: GroupId | undefined;
  structureEntityId: SystemStructureEntityId | undefined;
}> {
  switch (owner.kind) {
    case "member":
      await assertMemberActive(tx, systemId, owner.id);
      return { memberId: owner.id, groupId: undefined, structureEntityId: undefined };
    case "group":
      await assertGroupActive(tx, systemId, owner.id);
      return { memberId: undefined, groupId: owner.id, structureEntityId: undefined };
    case "structureEntity":
      await assertStructureEntityActive(tx, systemId, owner.id);
      return { memberId: undefined, groupId: undefined, structureEntityId: owner.id };
    default: {
      const _exhaustive: never = owner;
      throw new Error(`Unknown owner kind: ${(_exhaustive as FieldValueOwner).kind}`);
    }
  }
}

/** Build the where-clause column condition for an owner. */
export function ownerWhereColumn(owner: FieldValueOwner): SQL {
  switch (owner.kind) {
    case "member":
      return eq(fieldValues.memberId, owner.id);
    case "group":
      return eq(fieldValues.groupId, owner.id);
    case "structureEntity":
      return eq(fieldValues.structureEntityId, owner.id);
    default: {
      const _exhaustive: never = owner;
      throw new Error(`Unknown owner kind: ${(_exhaustive as FieldValueOwner).kind}`);
    }
  }
}
