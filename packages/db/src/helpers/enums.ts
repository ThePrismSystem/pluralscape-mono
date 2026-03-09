/**
 * Const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 * Used in both PG and SQLite table definitions.
 */

export const COMPLETENESS_LEVELS = ["fragment", "demi-member", "full"] as const;
export const FRONTING_TYPES = ["fronting", "co-conscious"] as const;
export const RELATIONSHIP_TYPES = [
  "split-from",
  "fused-from",
  "sibling",
  "partner",
  "parent-child",
  "protector-of",
  "caretaker-of",
  "gatekeeper-of",
  "source",
  "custom",
] as const;
export const LAYER_ACCESS_TYPES = ["open", "gatekept"] as const;
export const FRIEND_CONNECTION_STATUSES = ["pending", "accepted", "blocked", "removed"] as const;
export const BUCKET_VISIBILITY_SCOPES = [
  "members",
  "custom-fields",
  "fronting-status",
  "custom-fronts",
  "notes",
  "chat",
  "journal-entries",
  "member-photos",
  "groups",
] as const;
export const AUTH_KEY_TYPES = ["encryption", "signing"] as const;
export const DEVICE_TRANSFER_STATUSES = ["pending", "approved", "expired"] as const;
export const SYNC_OPERATIONS = ["create", "update", "delete"] as const;
export const SYNC_RESOLUTIONS = ["local", "remote", "merged"] as const;
