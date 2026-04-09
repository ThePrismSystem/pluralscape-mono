/**
 * Names of every Simply Plural collection that the import engine processes.
 *
 * Verified against `https://github.com/ApparyllisOrg/SimplyPluralApi/tree/release`.
 * Skipped collections (reminders, telemetry, auth, operational) are documented
 * in the design spec under "Skipped (not user content)".
 */
export const SP_COLLECTION_NAMES = [
  "users", // cherry-picked into systems.encryptedData
  "private", // cherry-picked into system_settings.encryptedData
  "privacyBuckets",
  "customFields",
  "frontStatuses", // SP's name for custom fronts
  "members",
  "groups",
  "frontHistory", // fronting sessions
  "comments", // fronting comments
  "notes", // → journal entries
  "polls",
  "channelCategories",
  "channels",
  "chatMessages",
  "boardMessages",
] as const;

export type SpCollectionName = (typeof SP_COLLECTION_NAMES)[number];

const SP_COLLECTION_SET = new Set<string>(SP_COLLECTION_NAMES);

/** Type guard narrowing an unknown string to a `SpCollectionName`. */
export function isSpCollectionName(value: string): value is SpCollectionName {
  return SP_COLLECTION_SET.has(value);
}
