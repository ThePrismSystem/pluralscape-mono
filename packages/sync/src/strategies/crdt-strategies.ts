/**
 * CRDT storage type taxonomy — how each entity type is stored in Automerge.
 *
 * lww-map:       Record<entityId, CrdtEntity>  — LWW per field
 * append-only:   CrdtEntity[]                  — append only, never mutated
 * append-lww:    Record<entityId, CrdtEntity>  — new entities via map assignment; some fields mutable
 * junction-map:  Record<compoundKey, true>      — add-wins semantics
 * singleton-lww: CrdtEntity at document root   — single instance, LWW per field
 */
export type CrdtStorageType =
  | "lww-map"
  | "append-only"
  | "append-lww"
  | "junction-map"
  | "singleton-lww";

import type { SyncDocumentType } from "../document-types.js";

/** The full CRDT strategy for a single entity type. */
export interface CrdtStrategy {
  /** How the entity is stored in Automerge. */
  readonly storageType: CrdtStorageType;
  /** Which document contains this entity type. */
  readonly document: SyncDocumentType;
  /**
   * Human-readable description of mutation semantics.
   * Summarises which fields are mutable after creation and what wins on conflict.
   */
  readonly mutationSemantics: string;
  /** The field name used to store this entity type in the Automerge document. */
  readonly fieldName: string;
  /** Parent reference field name, if this entity participates in hierarchy cycle detection. */
  readonly parentField?: string;
  /**
   * Whether this entity has a `sortOrder` field that participates in
   * post-merge tie-breaking normalization.
   */
  readonly hasSortOrder?: boolean;
  /**
   * Field name to group by for parent-scoped sort normalization.
   * When set, entities are partitioned by this field's value before tie
   * detection — siblings under different parents maintain independent orderings.
   */
  readonly sortGroupField?: string;
}

/**
 * Registry mapping every synced entity type to its CRDT strategy.
 *
 * Every entity type from the document topology must have an entry here.
 * Junction entity types use "junction-map" storage with compound keys.
 * Lifecycle events are stored as an append-lww map in system-core (archivable).
 */
export const ENTITY_CRDT_STRATEGIES = {
  // ── system-core document ─────────────────────────────────────────
  system: {
    storageType: "singleton-lww",
    document: "system-core",
    fieldName: "system",
    mutationSemantics: "LWW per field — name, displayName, description, avatarSource",
  },
  "system-settings": {
    storageType: "singleton-lww",
    document: "system-core",
    fieldName: "systemSettings",
    mutationSemantics: "LWW per field — all settings fields",
  },
  member: {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "members",
    mutationSemantics:
      "LWW per field — name, pronouns, description, avatarSource, colors, saturationLevel, tags, notification flags, archived",
  },
  "member-photo": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "memberPhotos",
    hasSortOrder: true,
    mutationSemantics: "LWW per field — imageSource, sortOrder, caption, archived",
  },
  group: {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "groups",
    parentField: "parentGroupId",
    hasSortOrder: true,
    mutationSemantics:
      "LWW per field — name, description, parentGroupId, imageSource, color, emoji, sortOrder, archived",
  },
  "structure-entity-type": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "structureEntityTypes",
    hasSortOrder: true,
    mutationSemantics: "LWW per field — name, description, visual, sortOrder, archived",
  },
  "structure-entity": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "structureEntities",
    hasSortOrder: true,
    mutationSemantics:
      "LWW per field — name, description, entityTypeId, visual, sortOrder, archived",
  },
  relationship: {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "relationships",
    mutationSemantics: "LWW per field — type, label, bidirectional, archived",
  },
  "custom-front": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "customFronts",
    mutationSemantics: "LWW per field — name, description, color, emoji, archived",
  },
  "fronting-report": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "frontingReports",
    mutationSemantics:
      "Immutable once created — no update endpoint exists; immutability enforced at the API layer",
  },
  "field-definition": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "fieldDefinitions",
    hasSortOrder: true,
    mutationSemantics:
      "LWW per field — name, description, fieldType, options, required, sortOrder, scopes, archived",
  },
  "field-value": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "fieldValues",
    mutationSemantics: "LWW per field — value, updatedAt",
  },
  "innerworld-entity": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "innerWorldEntities",
    mutationSemantics:
      "LWW per field — positionX, positionY, visual, regionId, type-specific fields, archived",
  },
  "innerworld-region": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "innerWorldRegions",
    parentField: "parentRegionId",
    mutationSemantics:
      "LWW per field — name, description, parentRegionId, visual, boundaryData, accessType, gatekeeperMemberIds, archived",
  },
  timer: {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "timers",
    mutationSemantics:
      "LWW per field — intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, promptText, enabled, archived",
  },
  "lifecycle-event": {
    storageType: "append-lww",
    document: "system-core",
    fieldName: "lifecycleEvents",
    mutationSemantics: "Append via map key assignment; archived is LWW-mutable after creation",
  },
  // Structure entity links (system-core)
  "structure-entity-link": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "structureEntityLinks",
    hasSortOrder: true,
    sortGroupField: "parentEntityId",
    mutationSemantics:
      "LWW per field — sortOrder, parentEntityId, archived mutable; entityId, systemId immutable after creation",
  },
  "structure-entity-member-link": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "structureEntityMemberLinks",
    hasSortOrder: true,
    sortGroupField: "parentEntityId",
    mutationSemantics:
      "LWW per field — sortOrder, parentEntityId, archived mutable; memberId, systemId immutable after creation",
  },
  "structure-entity-association": {
    storageType: "lww-map",
    document: "system-core",
    fieldName: "structureEntityAssociations",
    mutationSemantics:
      "LWW per field — archived mutable; sourceEntityId, targetEntityId, systemId immutable after creation",
  },
  // Junctions (system-core)
  "group-membership": {
    storageType: "junction-map",
    document: "system-core",
    fieldName: "groupMemberships",
    mutationSemantics:
      "Add-wins — compound key {groupId}_{memberId} mapped to true; concurrent add+remove preserves the junction",
  },

  // ── fronting document ────────────────────────────────────────────
  "fronting-session": {
    storageType: "append-lww",
    document: "fronting",
    fieldName: "sessions",
    mutationSemantics:
      "Append via map key assignment; endTime, comment, positionality, and archived are LWW-mutable after creation",
  },
  "fronting-comment": {
    storageType: "lww-map",
    document: "fronting",
    fieldName: "comments",
    mutationSemantics:
      "LWW per field — content, archived; author fields (memberId, customFrontId, structureEntityId) immutable",
  },
  "check-in-record": {
    storageType: "append-lww",
    document: "fronting",
    fieldName: "checkInRecords",
    mutationSemantics:
      "Append via map key assignment; respondedByMemberId, respondedAt, dismissed are LWW-mutable (topology correction — was append-only)",
  },

  // ── chat document ────────────────────────────────────────────────
  channel: {
    storageType: "singleton-lww",
    document: "chat",
    fieldName: "channel",
    mutationSemantics: "LWW per field — name, type, parentId, sortOrder, archived",
  },
  message: {
    storageType: "append-only",
    document: "chat",
    fieldName: "messages",
    mutationSemantics:
      "Immutable once appended; edits produce new entries with editOf reference to original",
  },
  "board-message": {
    storageType: "append-lww",
    document: "chat",
    fieldName: "boardMessages",
    mutationSemantics:
      "Append via map key assignment; pinned and sortOrder are LWW-mutable (topology correction — was append-only)",
  },
  poll: {
    storageType: "lww-map",
    document: "chat",
    fieldName: "polls",
    mutationSemantics: "LWW per field — title, description, status, closedAt, archived",
  },
  "poll-option": {
    storageType: "lww-map",
    document: "chat",
    fieldName: "pollOptions",
    mutationSemantics:
      "LWW per field — label, color, emoji; voteCount omitted (computed at read time)",
  },
  "poll-vote": {
    storageType: "append-only",
    document: "chat",
    fieldName: "pollVotes",
    mutationSemantics: "Immutable once appended — votes are permanent records",
  },
  acknowledgement: {
    storageType: "lww-map",
    document: "chat",
    fieldName: "acknowledgements",
    mutationSemantics:
      "LWW per field — confirmed and confirmedAt are mutable when target member acknowledges",
  },

  // ── journal document ─────────────────────────────────────────────
  "journal-entry": {
    storageType: "append-lww",
    document: "journal",
    fieldName: "entries",
    mutationSemantics:
      "Append via map key assignment; title, blocks, tags, linkedEntities are LWW-mutable after creation",
  },
  "wiki-page": {
    storageType: "lww-map",
    document: "journal",
    fieldName: "wikiPages",
    mutationSemantics:
      "LWW per field — title, slug, blocks, linkedFromPages, tags, linkedEntities, archived",
  },
  note: {
    storageType: "lww-map",
    document: "journal",
    fieldName: "notes",
    mutationSemantics: "LWW per field — title, content, backgroundColor, archived",
  },

  // ── privacy-config document ──────────────────────────────────────
  bucket: {
    storageType: "lww-map",
    document: "privacy-config",
    fieldName: "buckets",
    mutationSemantics: "LWW per field — name, description, archived",
  },
  "bucket-content-tag": {
    storageType: "lww-map",
    document: "privacy-config",
    fieldName: "contentTags",
    mutationSemantics:
      "LWW; compound key {entityType}_{entityId}_{bucketId} — deleting key removes assignment",
  },
  "friend-connection": {
    storageType: "lww-map",
    document: "privacy-config",
    fieldName: "friendConnections",
    mutationSemantics:
      "LWW per field — status, visibility, archived; assignedBuckets is a nested add-wins map keyed by bucketId",
  },
  "friend-code": {
    storageType: "lww-map",
    document: "privacy-config",
    fieldName: "friendCodes",
    mutationSemantics: "LWW per field — archived only (all other fields immutable after creation)",
  },
  "key-grant": {
    storageType: "append-lww",
    document: "privacy-config",
    fieldName: "keyGrants",
    mutationSemantics:
      "Append via map key assignment; revokedAt is the only LWW-mutable field (concurrent revocations are idempotent — safe outcome)",
  },
} as const satisfies Record<string, CrdtStrategy>;

/** All entity type keys in the strategy registry. */
export type SyncedEntityType = keyof typeof ENTITY_CRDT_STRATEGIES;
