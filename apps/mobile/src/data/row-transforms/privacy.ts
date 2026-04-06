import {
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBool,
  parseJsonSafe,
  parseStringArrayOrNull,
  rid,
  RowTransformError,
  strOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  FieldDefinitionDecrypted,
  FieldValueDecrypted,
} from "@pluralscape/data/transforms/custom-field";
import type {
  ArchivedPrivacyBucket,
  FieldValueUnion,
  PrivacyBucket,
  SystemId,
} from "@pluralscape/types";

export function rowToPrivacyBucket(
  row: Record<string, unknown>,
): PrivacyBucket | ArchivedPrivacyBucket {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "privacy_buckets", "updated_at", id);
  const base: PrivacyBucket = {
    id: guardedStr(row["id"], "privacy_buckets", "id", id) as PrivacyBucket["id"],
    systemId: guardedStr(
      row["system_id"],
      "privacy_buckets",
      "system_id",
      id,
    ) as PrivacyBucket["systemId"],
    name: guardedStr(row["name"], "privacy_buckets", "name", id),
    description: strOrNull(row["description"], "privacy_buckets", "description", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "privacy_buckets", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToFieldDefinition(row: Record<string, unknown>): FieldDefinitionDecrypted {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "field_definitions", "updated_at", id);
  return {
    id: guardedStr(row["id"], "field_definitions", "id", id) as FieldDefinitionDecrypted["id"],
    systemId: guardedStr(
      row["system_id"],
      "field_definitions",
      "system_id",
      id,
    ) as FieldDefinitionDecrypted["systemId"],
    name: guardedStr(row["name"], "field_definitions", "name", id),
    description: strOrNull(row["description"], "field_definitions", "description", id),
    fieldType: guardedStr(
      row["field_type"],
      "field_definitions",
      "field_type",
      id,
    ) as FieldDefinitionDecrypted["fieldType"],
    options: parseStringArrayOrNull(row["options"], "field_definitions", "options", id),
    required: intToBool(row["required"]),
    sortOrder: guardedNum(row["sort_order"], "field_definitions", "sort_order", id),
    archived,
    archivedAt: archived ? updatedAt : null,
    createdAt: guardedToMs(row["created_at"], "field_definitions", "created_at", id),
    updatedAt,
    version: 0,
  };
}

/**
 * The local `field_values` table stores the full `FieldValueUnion` as a
 * JSON-serialized string in the `value` column, and does not have a
 * `system_id` column. Pass the owning system's ID from the query context.
 */
export function rowToFieldValue(
  row: Record<string, unknown>,
  systemId: SystemId,
): FieldValueDecrypted {
  const id = rid(row);
  const valueRaw = parseJsonSafe(row["value"], "field_values", "value", id);
  if (
    valueRaw === null ||
    typeof valueRaw !== "object" ||
    typeof (valueRaw as Record<string, unknown>)["fieldType"] !== "string"
  ) {
    throw new RowTransformError(
      "field_values",
      "value",
      id,
      "invalid FieldValueUnion: missing or non-string fieldType",
    );
  }
  const valueUnion = valueRaw as FieldValueUnion;
  return {
    id: guardedStr(row["id"], "field_values", "id", id) as FieldValueDecrypted["id"],
    fieldDefinitionId: guardedStr(
      row["field_definition_id"],
      "field_values",
      "field_definition_id",
      id,
    ) as FieldValueDecrypted["fieldDefinitionId"],
    memberId: strOrNull(
      row["member_id"],
      "field_values",
      "member_id",
      id,
    ) as FieldValueDecrypted["memberId"],
    structureEntityId: strOrNull(
      row["structure_entity_id"],
      "field_values",
      "structure_entity_id",
      id,
    ) as FieldValueDecrypted["structureEntityId"],
    groupId: strOrNull(
      row["group_id"],
      "field_values",
      "group_id",
      id,
    ) as FieldValueDecrypted["groupId"],
    systemId,
    fieldType: valueUnion.fieldType,
    value: valueUnion.value,
    createdAt: guardedToMs(row["created_at"], "field_values", "created_at", id),
    updatedAt: guardedToMs(row["updated_at"], "field_values", "updated_at", id),
    version: 0,
  } as FieldValueDecrypted;
}
