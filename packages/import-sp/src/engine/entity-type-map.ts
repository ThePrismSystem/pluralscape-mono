import { SP_COLLECTION_NAMES } from "../sources/sp-collections.js";

import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportEntityType } from "@pluralscape/types";

/**
 * Static map from each SP collection to the Pluralscape `ImportEntityType`
 * the engine records on `import_entity_refs.source_entity_type`.
 *
 * Note that two SP collections (`friends`, `pendingFriendRequests`) both
 * map to `friend`. The inverse map below resolves the latter to the former
 * deterministically.
 */
const TO_ENTITY_TYPE: Readonly<Record<SpCollectionName, ImportEntityType>> = {
  users: "system-profile",
  private: "system-settings",
  privacyBuckets: "privacy-bucket",
  customFields: "field-definition",
  frontStatuses: "custom-front",
  members: "member",
  groups: "group",
  frontHistory: "fronting-session",
  comments: "fronting-comment",
  notes: "journal-entry",
  polls: "poll",
  channelCategories: "channel-category",
  channels: "channel",
  chatMessages: "chat-message",
  boardMessages: "board-message",
  friends: "friend",
  pendingFriendRequests: "friend",
};

const TO_COLLECTION: Partial<Record<ImportEntityType, SpCollectionName>> =
  buildInverse(TO_ENTITY_TYPE);

function buildInverse(
  forward: Readonly<Record<SpCollectionName, ImportEntityType>>,
): Partial<Record<ImportEntityType, SpCollectionName>> {
  const result: Partial<Record<ImportEntityType, SpCollectionName>> = {};
  for (const collection of SP_COLLECTION_NAMES) {
    const entityType = forward[collection];
    result[entityType] = collection;
  }
  return result;
}

export function collectionToEntityType(collection: SpCollectionName): ImportEntityType {
  return TO_ENTITY_TYPE[collection];
}

export function entityTypeToCollection(entityType: ImportEntityType): SpCollectionName {
  const collection = TO_COLLECTION[entityType];
  if (!collection) {
    throw new Error(`No SP collection mapping for entity type ${entityType}`);
  }
  return collection;
}
