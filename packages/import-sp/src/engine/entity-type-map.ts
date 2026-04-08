import { SP_COLLECTION_NAMES } from "../sources/sp-collections.js";

import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportEntityType } from "@pluralscape/types";

/**
 * Static map from each SP collection to the Pluralscape `ImportEntityType`
 * the engine records on `import_entity_refs.source_entity_type`.
 *
 * The `friends` and `pendingFriendRequests` collections both map forward to
 * `"friend"`. The inverse map resolves `"friend" → "friends"` as the canonical
 * collection (pending requests are a subset of friends), enforced via
 * `CANONICAL_OVERRIDES` after the default iteration.
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

/**
 * Explicit canonical inverse mappings for `ImportEntityType` values that have
 * multiple source collections. Applied after `buildInverse` so the chosen
 * collection wins regardless of declaration order in `SP_COLLECTION_NAMES`.
 */
const CANONICAL_OVERRIDES: readonly (readonly [ImportEntityType, SpCollectionName])[] = [
  ["friend", "friends"],
];

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
  for (const [entityType, collection] of CANONICAL_OVERRIDES) {
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
