import { type SpCollectionName } from "../sources/sp-collections.js";

/**
 * Fixed dependency order for SP collection import.
 *
 * Each collection's prerequisites must appear earlier in the array. This is
 * the order the engine walks during a fresh import; resumption skips to the
 * checkpoint's currentCollection without re-processing earlier ones.
 */
export const DEPENDENCY_ORDER: readonly SpCollectionName[] = [
  "users", // system profile cherry-pick
  "private", // system settings cherry-pick
  "privacyBuckets", // buckets must exist before members can be assigned
  "customFields", // field defs must exist before info extraction
  "frontStatuses", // custom fronts before frontHistory references them
  "members", // members + extracted field values
  "groups", // groups reference members
  "frontHistory", // sessions reference members or custom fronts
  "comments", // comments reference frontHistory
  "notes", // → journal entries, reference members
  "polls", // polls reference voters (members)
  "channelCategories", // categories before channels
  "channels", // channels reference categories
  "chatMessages", // messages reference channels and writers
  "boardMessages", // board messages reference writers
];

const ORDER_INDEX = new Map<SpCollectionName, number>(
  DEPENDENCY_ORDER.map((name, idx) => [name, idx]),
);

export function nextCollection(current: SpCollectionName): SpCollectionName | null {
  const idx = ORDER_INDEX.get(current);
  if (idx === undefined) return null;
  return DEPENDENCY_ORDER[idx + 1] ?? null;
}

export function collectionsAfter(current: SpCollectionName): readonly SpCollectionName[] {
  const idx = ORDER_INDEX.get(current);
  if (idx === undefined) return [];
  return DEPENDENCY_ORDER.slice(idx);
}
