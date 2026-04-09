import { SP_COLLECTION_NAMES } from "../sources/sp-collections.js";

import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportCollectionType } from "@pluralscape/types";

/**
 * Static map from each SP collection to the Pluralscape `ImportCollectionType`
 * the engine records on `import_entity_refs.source_entity_type`. Real SP
 * collections never resolve to `"unknown"` — that value is reserved for
 * error-log categorization only — so the map is typed as
 * `ImportCollectionType` (which excludes `"unknown"`).
 *
 * The `friends` and `pendingFriendRequests` collections both map forward to
 * `"friend"`. The inverse map resolves `"friend" → "friends"` as the canonical
 * collection (pending requests are a subset of friends), enforced via
 * `CANONICAL_OVERRIDES` after the default iteration.
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
  friends: "friend",
  pendingFriendRequests: "friend",
};

/**
 * Explicit canonical inverse mappings for `ImportEntityType` values that have
 * multiple source collections. Applied after `buildInverse` so the chosen
 * collection wins regardless of declaration order in `SP_COLLECTION_NAMES`.
 */
const CANONICAL_OVERRIDES: readonly (readonly [ImportCollectionType, SpCollectionName])[] = [
  ["friend", "friends"],
];

const TO_COLLECTION: Partial<Record<ImportCollectionType, SpCollectionName>> =
  buildInverse(TO_ENTITY_TYPE);

function buildInverse(
  forward: Readonly<Record<SpCollectionName, ImportCollectionType>>,
): Partial<Record<ImportCollectionType, SpCollectionName>> {
  const result: Partial<Record<ImportCollectionType, SpCollectionName>> = {};
  for (const collection of SP_COLLECTION_NAMES) {
    const entityType = forward[collection];
    result[entityType] = collection;
  }
  for (const [entityType, collection] of CANONICAL_OVERRIDES) {
    result[entityType] = collection;
  }
  return result;
}

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
