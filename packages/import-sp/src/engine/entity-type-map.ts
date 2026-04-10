import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportCollectionType } from "@pluralscape/types";

/**
 * Canonical mapping from each SP collection to the Pluralscape
 * `ImportCollectionType` recorded on `import_entity_refs.source_entity_type`.
 *
 * No collisions exist (friends and friend requests were dropped from import
 * — see PR #402 review), so a literal record is exhaustive and trivially
 * invertible.
 */
const TO_ENTITY_TYPE: Readonly<Record<SpCollectionName, ImportCollectionType>> = {
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
};

const TO_COLLECTION: Partial<Record<ImportCollectionType, SpCollectionName>> = (() => {
  const result: Partial<Record<ImportCollectionType, SpCollectionName>> = {};
  for (const [collection, entityType] of Object.entries(TO_ENTITY_TYPE) as Array<
    [SpCollectionName, ImportCollectionType]
  >) {
    result[entityType] = collection;
  }
  return result;
})();

export function collectionToEntityType(collection: SpCollectionName): ImportCollectionType {
  return TO_ENTITY_TYPE[collection];
}

export function entityTypeToCollection(entityType: ImportCollectionType): SpCollectionName {
  const collection = TO_COLLECTION[entityType];
  if (!collection) {
    throw new Error(`No SP collection mapping for entity type ${entityType}`);
  }
  return collection;
}
