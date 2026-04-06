import {
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBool,
  parseJsonSafe,
  rid,
  strOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  ArchivedSystemStructureEntity,
  ArchivedSystemStructureEntityType,
  SystemStructureEntity,
  SystemStructureEntityAssociation,
  SystemStructureEntityLink,
  SystemStructureEntityMemberLink,
  SystemStructureEntityType,
} from "@pluralscape/types";

export function rowToStructureEntityType(
  row: Record<string, unknown>,
): SystemStructureEntityType | ArchivedSystemStructureEntityType {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(
    row["updated_at"],
    "system_structure_entity_types",
    "updated_at",
    id,
  );
  const base: SystemStructureEntityType = {
    id: guardedStr(
      row["id"],
      "system_structure_entity_types",
      "id",
      id,
    ) as SystemStructureEntityType["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_types",
      "system_id",
      id,
    ) as SystemStructureEntityType["systemId"],
    name: guardedStr(row["name"], "system_structure_entity_types", "name", id),
    description: strOrNull(row["description"], "system_structure_entity_types", "description", id),
    color: strOrNull(
      row["color"],
      "system_structure_entity_types",
      "color",
      id,
    ) as SystemStructureEntityType["color"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "system_structure_entity_types",
      "image_source",
      id,
    ) as SystemStructureEntityType["imageSource"],
    emoji: strOrNull(row["emoji"], "system_structure_entity_types", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "system_structure_entity_types", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "system_structure_entity_types", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToStructureEntity(
  row: Record<string, unknown>,
): SystemStructureEntity | ArchivedSystemStructureEntity {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "system_structure_entities", "updated_at", id);
  const base: SystemStructureEntity = {
    id: guardedStr(row["id"], "system_structure_entities", "id", id) as SystemStructureEntity["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entities",
      "system_id",
      id,
    ) as SystemStructureEntity["systemId"],
    entityTypeId: guardedStr(
      row["entity_type_id"],
      "system_structure_entities",
      "entity_type_id",
      id,
    ) as SystemStructureEntity["entityTypeId"],
    name: guardedStr(row["name"], "system_structure_entities", "name", id),
    description: strOrNull(row["description"], "system_structure_entities", "description", id),
    color: strOrNull(
      row["color"],
      "system_structure_entities",
      "color",
      id,
    ) as SystemStructureEntity["color"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "system_structure_entities",
      "image_source",
      id,
    ) as SystemStructureEntity["imageSource"],
    emoji: strOrNull(row["emoji"], "system_structure_entities", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "system_structure_entities", "sort_order", id),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "system_structure_entities", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToStructureEntityLink(row: Record<string, unknown>): SystemStructureEntityLink {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_links",
      "id",
      id,
    ) as SystemStructureEntityLink["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_links",
      "system_id",
      id,
    ) as SystemStructureEntityLink["systemId"],
    entityId: guardedStr(
      row["entity_id"],
      "system_structure_entity_links",
      "entity_id",
      id,
    ) as SystemStructureEntityLink["entityId"],
    parentEntityId: strOrNull(
      row["parent_entity_id"],
      "system_structure_entity_links",
      "parent_entity_id",
      id,
    ) as SystemStructureEntityLink["parentEntityId"],
    sortOrder: guardedNum(row["sort_order"], "system_structure_entity_links", "sort_order", id),
    createdAt: guardedToMs(row["created_at"], "system_structure_entity_links", "created_at", id),
  };
}

export function rowToStructureEntityMemberLink(
  row: Record<string, unknown>,
): SystemStructureEntityMemberLink {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_member_links",
      "id",
      id,
    ) as SystemStructureEntityMemberLink["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_member_links",
      "system_id",
      id,
    ) as SystemStructureEntityMemberLink["systemId"],
    memberId: guardedStr(
      row["member_id"],
      "system_structure_entity_member_links",
      "member_id",
      id,
    ) as SystemStructureEntityMemberLink["memberId"],
    parentEntityId: strOrNull(
      row["parent_entity_id"],
      "system_structure_entity_member_links",
      "parent_entity_id",
      id,
    ) as SystemStructureEntityMemberLink["parentEntityId"],
    sortOrder: guardedNum(
      row["sort_order"],
      "system_structure_entity_member_links",
      "sort_order",
      id,
    ),
    createdAt: guardedToMs(
      row["created_at"],
      "system_structure_entity_member_links",
      "created_at",
      id,
    ),
  };
}

export function rowToStructureEntityAssociation(
  row: Record<string, unknown>,
): SystemStructureEntityAssociation {
  const id = rid(row);
  return {
    id: guardedStr(
      row["id"],
      "system_structure_entity_associations",
      "id",
      id,
    ) as SystemStructureEntityAssociation["id"],
    systemId: guardedStr(
      row["system_id"],
      "system_structure_entity_associations",
      "system_id",
      id,
    ) as SystemStructureEntityAssociation["systemId"],
    sourceEntityId: guardedStr(
      row["source_entity_id"],
      "system_structure_entity_associations",
      "source_entity_id",
      id,
    ) as SystemStructureEntityAssociation["sourceEntityId"],
    targetEntityId: guardedStr(
      row["target_entity_id"],
      "system_structure_entity_associations",
      "target_entity_id",
      id,
    ) as SystemStructureEntityAssociation["targetEntityId"],
    createdAt: guardedToMs(
      row["created_at"],
      "system_structure_entity_associations",
      "created_at",
      id,
    ),
  };
}
