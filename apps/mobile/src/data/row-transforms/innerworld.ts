import {
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBool,
  parseJsonRequired,
  parseStringArray,
  rid,
  strOrNull,
  wrapArchived,
} from "./primitives.js";

import type {
  ArchivedInnerWorldEntity,
  ArchivedInnerWorldRegion,
  InnerWorldEntity,
  InnerWorldRegion,
  MemberId,
  SystemStructureEntityId,
} from "@pluralscape/types";

export function rowToInnerWorldEntity(
  row: Record<string, unknown>,
): InnerWorldEntity | ArchivedInnerWorldEntity {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "innerworld_entities", "updated_at", id);
  const entityType = guardedStr(
    row["entity_type"],
    "innerworld_entities",
    "entity_type",
    id,
  ) as InnerWorldEntity["entityType"];
  const baseCommon = {
    id: guardedStr(row["id"], "innerworld_entities", "id", id) as InnerWorldEntity["id"],
    systemId: guardedStr(
      row["system_id"],
      "innerworld_entities",
      "system_id",
      id,
    ) as InnerWorldEntity["systemId"],
    positionX: guardedNum(row["position_x"], "innerworld_entities", "position_x", id),
    positionY: guardedNum(row["position_y"], "innerworld_entities", "position_y", id),
    visual: parseJsonRequired(
      row["visual"],
      "innerworld_entities",
      "visual",
      id,
    ) as InnerWorldEntity["visual"],
    regionId: strOrNull(
      row["region_id"],
      "innerworld_entities",
      "region_id",
      id,
    ) as InnerWorldEntity["regionId"],
    archived: false as const,
    createdAt: guardedToMs(row["created_at"], "innerworld_entities", "created_at", id),
    updatedAt,
    version: 0,
  };

  if (entityType === "member") {
    const memberEntity = {
      ...baseCommon,
      entityType: "member" as const,
      linkedMemberId: guardedStr(
        row["linked_member_id"],
        "innerworld_entities",
        "linked_member_id",
        id,
      ) as MemberId,
    };
    return archived ? wrapArchived(memberEntity, updatedAt) : memberEntity;
  }
  if (entityType === "landmark") {
    const landmarkEntity = {
      ...baseCommon,
      entityType: "landmark" as const,
      name: strOrNull(row["name"], "innerworld_entities", "name", id) ?? "",
      description: strOrNull(row["description"], "innerworld_entities", "description", id),
    };
    return archived ? wrapArchived(landmarkEntity, updatedAt) : landmarkEntity;
  }
  const structureEntity = {
    ...baseCommon,
    entityType: "structure-entity" as const,
    linkedStructureEntityId: guardedStr(
      row["linked_structure_entity_id"],
      "innerworld_entities",
      "linked_structure_entity_id",
      id,
    ) as SystemStructureEntityId,
  };
  return archived ? wrapArchived(structureEntity, updatedAt) : structureEntity;
}

export function rowToInnerWorldRegion(
  row: Record<string, unknown>,
): InnerWorldRegion | ArchivedInnerWorldRegion {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "innerworld_regions", "updated_at", id);
  const base: InnerWorldRegion = {
    id: guardedStr(row["id"], "innerworld_regions", "id", id) as InnerWorldRegion["id"],
    systemId: guardedStr(
      row["system_id"],
      "innerworld_regions",
      "system_id",
      id,
    ) as InnerWorldRegion["systemId"],
    name: guardedStr(row["name"], "innerworld_regions", "name", id),
    description: strOrNull(row["description"], "innerworld_regions", "description", id),
    parentRegionId: strOrNull(
      row["parent_region_id"],
      "innerworld_regions",
      "parent_region_id",
      id,
    ) as InnerWorldRegion["parentRegionId"],
    visual: parseJsonRequired(
      row["visual"],
      "innerworld_regions",
      "visual",
      id,
    ) as InnerWorldRegion["visual"],
    boundaryData: parseJsonRequired(
      row["boundary_data"],
      "innerworld_regions",
      "boundary_data",
      id,
    ) as InnerWorldRegion["boundaryData"],
    accessType: guardedStr(
      row["access_type"],
      "innerworld_regions",
      "access_type",
      id,
    ) as InnerWorldRegion["accessType"],
    gatekeeperMemberIds: parseStringArray(
      row["gatekeeper_member_ids"],
      "innerworld_regions",
      "gatekeeper_member_ids",
      id,
    ) as InnerWorldRegion["gatekeeperMemberIds"],
    archived: false,
    createdAt: guardedToMs(row["created_at"], "innerworld_regions", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}
