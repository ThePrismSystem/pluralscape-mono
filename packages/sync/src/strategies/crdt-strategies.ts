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
}

/**
 * Registry mapping every synced entity type to its CRDT strategy.
 *
 * Every entity type from the document topology must have an entry here.
 * Junction entity types use "junction-map" storage with compound keys.
 * Lifecycle events are stored as an append-only list in system-core.
 */
export const ENTITY_CRDT_STRATEGIES = {
  // ── system-core document ─────────────────────────────────────────
  system: {
    storageType: "singleton-lww",
    document: "system-core",
    mutationSemantics: "LWW per field — name, displayName, description, avatarSource",
  },
  "system-settings": {
    storageType: "singleton-lww",
    document: "system-core",
    mutationSemantics: "LWW per field — all settings fields",
  },
  member: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, pronouns, description, avatarSource, colors, saturationLevel, tags, notification flags, archived",
  },
  "member-photo": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics: "LWW per field — imageSource, sortOrder, caption, archived",
  },
  group: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, description, parentGroupId, imageSource, color, emoji, sortOrder, archived",
  },
  subsystem: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, description, parentSubsystemId, architectureType, hasCore, discoveryStatus, visual, archived",
  },
  "side-system": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics: "LWW per field — name, description, visual, archived",
  },
  layer: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, description, accessType, gatekeeperMemberIds, visual, archived",
  },
  relationship: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics: "LWW per field — type, label, bidirectional, archived",
  },
  "custom-front": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics: "LWW per field — name, description, color, emoji, archived",
  },
  "field-definition": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, description, fieldType, options, required, sortOrder, archived",
  },
  "field-value": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics: "LWW per field — value, updatedAt",
  },
  "innerworld-entity": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — positionX, positionY, visual, regionId, type-specific fields, archived",
  },
  "innerworld-region": {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — name, description, parentRegionId, visual, boundaryData, accessType, gatekeeperMemberIds, archived",
  },
  timer: {
    storageType: "lww-map",
    document: "system-core",
    mutationSemantics:
      "LWW per field — intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, promptText, enabled, archived",
  },
  "lifecycle-event": {
    storageType: "append-only",
    document: "system-core",
    mutationSemantics: "Immutable once appended — append-only list in system-core document",
  },
  // Junctions (system-core)
  "group-membership": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics:
      "Add-wins — compound key {groupId}_{memberId} mapped to true; concurrent add+remove preserves the junction",
  },
  "subsystem-membership": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {subsystemId}_{memberId} mapped to true",
  },
  "side-system-membership": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {sideSystemId}_{memberId} mapped to true",
  },
  "layer-membership": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {layerId}_{memberId} mapped to true",
  },
  "subsystem-layer-link": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {subsystemId}_{layerId} mapped to true",
  },
  "subsystem-side-system-link": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {subsystemId}_{sideSystemId} mapped to true",
  },
  "side-system-layer-link": {
    storageType: "junction-map",
    document: "system-core",
    mutationSemantics: "Add-wins — compound key {sideSystemId}_{layerId} mapped to true",
  },

  // ── fronting document ────────────────────────────────────────────
  "fronting-session": {
    storageType: "append-lww",
    document: "fronting",
    mutationSemantics:
      "Append via map key assignment; endTime, comment, positionality, and archived are LWW-mutable after creation",
  },
  "fronting-comment": {
    storageType: "lww-map",
    document: "fronting",
    mutationSemantics: "LWW per field — content, archived",
  },
  switch: {
    storageType: "append-only",
    document: "fronting",
    mutationSemantics: "Immutable once appended — records the moment control transfers",
  },
  "check-in-record": {
    storageType: "append-lww",
    document: "fronting",
    mutationSemantics:
      "Append via map key assignment; respondedByMemberId, respondedAt, dismissed are LWW-mutable (topology correction — was append-only)",
  },

  // ── chat document ────────────────────────────────────────────────
  channel: {
    storageType: "singleton-lww",
    document: "chat",
    mutationSemantics: "LWW per field — name, type, parentId, sortOrder, archived",
  },
  message: {
    storageType: "append-only",
    document: "chat",
    mutationSemantics:
      "Immutable once appended; edits produce new entries with editOf reference to original",
  },
  "board-message": {
    storageType: "append-lww",
    document: "chat",
    mutationSemantics:
      "Append via map key assignment; pinned and sortOrder are LWW-mutable (topology correction — was append-only)",
  },
  poll: {
    storageType: "lww-map",
    document: "chat",
    mutationSemantics: "LWW per field — title, description, status, closedAt, archived",
  },
  "poll-option": {
    storageType: "lww-map",
    document: "chat",
    mutationSemantics:
      "LWW per field — label, color, emoji; voteCount omitted (computed at read time)",
  },
  "poll-vote": {
    storageType: "append-only",
    document: "chat",
    mutationSemantics: "Immutable once appended — votes are permanent records",
  },
  acknowledgement: {
    storageType: "lww-map",
    document: "chat",
    mutationSemantics:
      "LWW per field — confirmed and confirmedAt are mutable when target member acknowledges",
  },

  // ── journal document ─────────────────────────────────────────────
  "journal-entry": {
    storageType: "append-lww",
    document: "journal",
    mutationSemantics:
      "Append via map key assignment; title, blocks, tags, linkedEntities are LWW-mutable after creation",
  },
  "wiki-page": {
    storageType: "lww-map",
    document: "journal",
    mutationSemantics:
      "LWW per field — title, slug, blocks, linkedFromPages, tags, linkedEntities, archived",
  },
  note: {
    storageType: "lww-map",
    document: "journal",
    mutationSemantics: "LWW per field — title, content, backgroundColor, archived",
  },

  // ── privacy-config document ──────────────────────────────────────
  bucket: {
    storageType: "lww-map",
    document: "privacy-config",
    mutationSemantics: "LWW per field — name, description, archived",
  },
  "bucket-content-tag": {
    storageType: "lww-map",
    document: "privacy-config",
    mutationSemantics:
      "LWW; compound key {entityType}_{entityId}_{bucketId} — deleting key removes assignment",
  },
  "friend-connection": {
    storageType: "lww-map",
    document: "privacy-config",
    mutationSemantics:
      "LWW per field — status, visibility, archived; assignedBuckets is a nested add-wins map keyed by bucketId",
  },
  "friend-code": {
    storageType: "lww-map",
    document: "privacy-config",
    mutationSemantics: "LWW per field — archived only (all other fields immutable after creation)",
  },
  "key-grant": {
    storageType: "append-lww",
    document: "privacy-config",
    mutationSemantics:
      "Append via map key assignment; revokedAt is the only LWW-mutable field (concurrent revocations are idempotent — safe outcome)",
  },
} as const satisfies Record<string, CrdtStrategy>;

/** All entity type keys in the strategy registry. */
export type SyncedEntityType = keyof typeof ENTITY_CRDT_STRATEGIES;
