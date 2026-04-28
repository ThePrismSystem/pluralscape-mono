import type { SyncedEntityType } from "../strategies/crdt-strategies.js";

/**
 * Behaviour metadata for a materialized entity type — the parts of
 * the legacy `EntityTableDef` that don't live in the Drizzle schema.
 *
 * `hotPath` and `compoundDetailKey` drive query-invalidation routing
 * in the mobile app. `ftsColumns` is the list of columns indexed by
 * the FTS5 virtual table for full-text search; an empty array means
 * the entity has no FTS index.
 */
export interface EntityMetadata {
  readonly hotPath: boolean;
  readonly ftsColumns: readonly string[];
  /**
   * When true, the React Query detail key for this entity type is NOT
   * shaped `[tableName, entityId]` — it embeds additional scoping slots
   * (e.g., `messages` uses `[tableName, channelId, entityId]`). The
   * hot-path narrowing optimisation in the query invalidator relies on
   * `[tableName, entityId]` detail keys to be covered by per-entity
   * events; for compound keys, that doesn't work, so the invalidator
   * must fall back to broad `[tableName]` invalidation on document
   * events even when `hotPath` is true.
   */
  readonly compoundDetailKey?: boolean;
}

/**
 * Per-entity-type behaviour metadata. The values here previously lived
 * inline in `entity-registry.ts`'s `EntityTableDef` records; they're
 * extracted now that the schema portion is supplied by Drizzle.
 */
export const ENTITY_METADATA = {
  // ── system-core document ──────────────────────────────────────────
  system: { hotPath: false, ftsColumns: ["name", "display_name", "description"] },
  "system-settings": { hotPath: false, ftsColumns: [] },
  member: { hotPath: false, ftsColumns: ["name", "description"] },
  "member-photo": { hotPath: false, ftsColumns: [] },
  group: { hotPath: false, ftsColumns: ["name", "description"] },
  "group-membership": { hotPath: false, ftsColumns: [] },
  "structure-entity-type": { hotPath: false, ftsColumns: ["name", "description"] },
  "structure-entity": { hotPath: false, ftsColumns: ["name", "description"] },
  "structure-entity-link": { hotPath: false, ftsColumns: [] },
  "structure-entity-member-link": { hotPath: false, ftsColumns: [] },
  "structure-entity-association": { hotPath: false, ftsColumns: [] },
  relationship: { hotPath: false, ftsColumns: ["label"] },
  "custom-front": { hotPath: false, ftsColumns: ["name", "description"] },
  "fronting-report": { hotPath: false, ftsColumns: [] },
  "field-definition": { hotPath: false, ftsColumns: ["name", "description"] },
  "field-value": { hotPath: false, ftsColumns: [] },
  "innerworld-entity": { hotPath: false, ftsColumns: ["name", "description"] },
  "innerworld-region": { hotPath: false, ftsColumns: ["name", "description"] },
  "innerworld-canvas": { hotPath: false, ftsColumns: [] },
  timer: { hotPath: false, ftsColumns: [] },
  "lifecycle-event": { hotPath: false, ftsColumns: ["notes"] },
  "webhook-config": { hotPath: false, ftsColumns: [] },

  // ── fronting document ─────────────────────────────────────────────
  "fronting-session": { hotPath: true, ftsColumns: ["comment"] },
  "fronting-comment": { hotPath: true, ftsColumns: ["content"] },
  "check-in-record": { hotPath: true, ftsColumns: [] },

  // ── chat document ─────────────────────────────────────────────────
  channel: { hotPath: true, ftsColumns: ["name"] },
  message: { hotPath: true, ftsColumns: ["content"], compoundDetailKey: true },
  "board-message": { hotPath: true, ftsColumns: ["content"] },
  poll: { hotPath: true, ftsColumns: ["title", "description"] },
  "poll-option": { hotPath: true, ftsColumns: ["label"] },
  "poll-vote": { hotPath: true, ftsColumns: ["comment"] },
  acknowledgement: { hotPath: true, ftsColumns: ["message"] },

  // ── journal document ──────────────────────────────────────────────
  "journal-entry": { hotPath: false, ftsColumns: ["title"] },
  "wiki-page": { hotPath: false, ftsColumns: ["title"] },
  note: { hotPath: false, ftsColumns: ["title", "content"] },

  // ── privacy-config document ───────────────────────────────────────
  bucket: { hotPath: false, ftsColumns: ["name", "description"] },
  "bucket-content-tag": { hotPath: false, ftsColumns: [] },
  "friend-connection": { hotPath: false, ftsColumns: [] },
  "friend-code": { hotPath: false, ftsColumns: [] },
  "key-grant": { hotPath: false, ftsColumns: [] },
  "field-bucket-visibility": { hotPath: false, ftsColumns: [] },
} as const satisfies Record<SyncedEntityType, EntityMetadata>;

/**
 * Entity types whose data is shared with friends. Used by local-schema
 * (friend_ table generation), friend-indexer (re-indexing), and search
 * (friend scope queries).
 */
export const FRIEND_EXPORTABLE_ENTITY_TYPES: ReadonlySet<SyncedEntityType> =
  new Set<SyncedEntityType>([
    "member",
    "group",
    "channel",
    "message",
    "note",
    "poll",
    "relationship",
    "structure-entity-type",
    "structure-entity",
    "journal-entry",
    "wiki-page",
    "custom-front",
    "fronting-session",
    "board-message",
    "acknowledgement",
    "innerworld-entity",
    "innerworld-region",
    "field-definition",
    "field-value",
    "member-photo",
    "fronting-comment",
  ]);
