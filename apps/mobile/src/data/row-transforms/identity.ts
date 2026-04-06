import {
  guardedNum,
  guardedStr,
  guardedToMs,
  intToBool,
  intToBoolFailClosed,
  parseJsonRequired,
  parseJsonSafe,
  parseStringArray,
  rid,
  strOrNull,
  wrapArchived,
} from "./primitives.js";

import type { GroupDecrypted } from "@pluralscape/data/transforms/group";
import type {
  ArchivedMember,
  ArchivedMemberPhoto,
  ArchivedRelationship,
  Member,
  MemberPhoto,
  Relationship,
} from "@pluralscape/types";

export function rowToMember(row: Record<string, unknown>): Member | ArchivedMember {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "members", "updated_at", id);
  const base: Member = {
    id: guardedStr(row["id"], "members", "id", id) as Member["id"],
    systemId: guardedStr(row["system_id"], "members", "system_id", id) as Member["systemId"],
    name: guardedStr(row["name"], "members", "name", id),
    pronouns: parseStringArray(row["pronouns"], "members", "pronouns", id),
    description: strOrNull(row["description"], "members", "description", id),
    avatarSource: parseJsonSafe(
      row["avatar_source"],
      "members",
      "avatar_source",
      id,
    ) as Member["avatarSource"],
    colors: parseStringArray(row["colors"], "members", "colors", id) as Member["colors"],
    saturationLevel: parseJsonRequired(
      row["saturation_level"],
      "members",
      "saturation_level",
      id,
    ) as Member["saturationLevel"],
    tags: parseJsonRequired(row["tags"], "members", "tags", id) as Member["tags"],
    suppressFriendFrontNotification: intToBoolFailClosed(row["suppress_friend_front_notification"]),
    boardMessageNotificationOnFront: intToBoolFailClosed(
      row["board_message_notification_on_front"],
    ),
    archived: false,
    createdAt: guardedToMs(row["created_at"], "members", "created_at", id),
    updatedAt,
    version: 0,
  };
  return archived ? wrapArchived(base, updatedAt) : base;
}

export function rowToMemberPhoto(row: Record<string, unknown>): MemberPhoto | ArchivedMemberPhoto {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const base: MemberPhoto = {
    id: guardedStr(row["id"], "member_photos", "id", id) as MemberPhoto["id"],
    memberId: guardedStr(
      row["member_id"],
      "member_photos",
      "member_id",
      id,
    ) as MemberPhoto["memberId"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "member_photos",
      "image_source",
      id,
    ) as MemberPhoto["imageSource"],
    sortOrder: guardedNum(row["sort_order"], "member_photos", "sort_order", id),
    caption: strOrNull(row["caption"], "member_photos", "caption", id),
    archived: false,
  };
  if (archived) {
    // MemberPhoto has no updatedAt; use createdAt as proxy
    const createdAt = guardedToMs(row["created_at"], "member_photos", "created_at", id);
    return wrapArchived(base, createdAt);
  }
  return base;
}

export function rowToGroup(row: Record<string, unknown>): GroupDecrypted {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const updatedAt = guardedToMs(row["updated_at"], "groups", "updated_at", id);
  return {
    id: guardedStr(row["id"], "groups", "id", id) as GroupDecrypted["id"],
    systemId: guardedStr(row["system_id"], "groups", "system_id", id) as GroupDecrypted["systemId"],
    name: guardedStr(row["name"], "groups", "name", id),
    description: strOrNull(row["description"], "groups", "description", id),
    parentGroupId: strOrNull(
      row["parent_group_id"],
      "groups",
      "parent_group_id",
      id,
    ) as GroupDecrypted["parentGroupId"],
    imageSource: parseJsonSafe(
      row["image_source"],
      "groups",
      "image_source",
      id,
    ) as GroupDecrypted["imageSource"],
    color: strOrNull(row["color"], "groups", "color", id) as GroupDecrypted["color"],
    emoji: strOrNull(row["emoji"], "groups", "emoji", id),
    sortOrder: guardedNum(row["sort_order"], "groups", "sort_order", id),
    archived,
    archivedAt: archived ? updatedAt : null,
    createdAt: guardedToMs(row["created_at"], "groups", "created_at", id),
    updatedAt,
    version: 0,
  };
}

export function rowToRelationship(
  row: Record<string, unknown>,
): Relationship | ArchivedRelationship {
  const id = rid(row);
  const archived = intToBool(row["archived"]);
  const createdAt = guardedToMs(row["created_at"], "relationships", "created_at", id);
  const base: Relationship = {
    id: guardedStr(row["id"], "relationships", "id", id) as Relationship["id"],
    systemId: guardedStr(
      row["system_id"],
      "relationships",
      "system_id",
      id,
    ) as Relationship["systemId"],
    sourceMemberId: strOrNull(
      row["source_member_id"],
      "relationships",
      "source_member_id",
      id,
    ) as Relationship["sourceMemberId"],
    targetMemberId: strOrNull(
      row["target_member_id"],
      "relationships",
      "target_member_id",
      id,
    ) as Relationship["targetMemberId"],
    type: guardedStr(row["type"], "relationships", "type", id) as Relationship["type"],
    label: strOrNull(row["label"], "relationships", "label", id),
    bidirectional: intToBool(row["bidirectional"]),
    createdAt,
    archived: false,
  };
  return archived ? wrapArchived(base, createdAt) : base;
}
