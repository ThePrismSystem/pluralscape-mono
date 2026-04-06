/**
 * Scope domain identifiers for API key permission granularity.
 * Each domain maps to one or more entity types.
 */
export const SCOPE_DOMAINS = [
  "members",
  "fronting",
  "groups",
  "system",
  "structure",
  "reports",
  "webhooks",
  "blobs",
  "notifications",
  "acknowledgements",
  "channels",
  "messages",
  "notes",
  "polls",
  "relationships",
  "innerworld",
  "fields",
  "check-ins",
  "lifecycle-events",
  "timers",
  "buckets",
  "friends",
] as const;

/** A scope domain — the entity group a scope applies to. */
export type ScopeDomain = (typeof SCOPE_DOMAINS)[number];

/** Scope tiers ordered by privilege: read < write < delete. */
export type ScopeTier = "read" | "write" | "delete";

/**
 * Scopes that can be *required* by an endpoint.
 * Per-entity scopes + "full" (for api-keys endpoints).
 * Aggregates (read-all, write-all, delete-all) are grant-side only.
 */
export type RequiredScope = `${ScopeTier}:${ScopeDomain}` | "read:audit-log" | "full";
