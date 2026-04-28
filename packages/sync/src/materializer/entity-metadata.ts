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
   *
   * Required (not optional) so every entry has to make a deliberate
   * choice — silently inheriting `undefined` means a future entity that
   * adopts a compound detail key wouldn't fail loudly when the flag is
   * forgotten.
   */
  readonly compoundDetailKey: boolean;
}

/**
 * Per-entity-type behaviour metadata. Drives query-invalidation routing
 * (`hotPath`, `compoundDetailKey`) and search-index generation (`ftsColumns`).
 */
export const ENTITY_METADATA = {
  // ── system-core document ──────────────────────────────────────────
  system: {
    hotPath: false,
    ftsColumns: ["name", "display_name", "description"],
    compoundDetailKey: false,
  },
  "system-settings": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  member: { hotPath: false, ftsColumns: ["name", "description"], compoundDetailKey: false },
  "member-photo": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  group: { hotPath: false, ftsColumns: ["name", "description"], compoundDetailKey: false },
  "group-membership": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "structure-entity-type": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
  },
  "structure-entity": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
  },
  "structure-entity-link": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "structure-entity-member-link": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "structure-entity-association": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  relationship: { hotPath: false, ftsColumns: ["label"], compoundDetailKey: false },
  "custom-front": { hotPath: false, ftsColumns: ["name", "description"], compoundDetailKey: false },
  "fronting-report": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "field-definition": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
  },
  "field-value": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "innerworld-entity": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
  },
  "innerworld-region": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
  },
  "innerworld-canvas": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  timer: { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "lifecycle-event": { hotPath: false, ftsColumns: ["notes"], compoundDetailKey: false },
  "webhook-config": { hotPath: false, ftsColumns: [], compoundDetailKey: false },

  // ── fronting document ─────────────────────────────────────────────
  "fronting-session": { hotPath: true, ftsColumns: ["comment"], compoundDetailKey: false },
  "fronting-comment": { hotPath: true, ftsColumns: ["content"], compoundDetailKey: false },
  "check-in-record": { hotPath: true, ftsColumns: [], compoundDetailKey: false },

  // ── chat document ─────────────────────────────────────────────────
  channel: { hotPath: true, ftsColumns: ["name"], compoundDetailKey: false },
  message: { hotPath: true, ftsColumns: ["content"], compoundDetailKey: true },
  "board-message": { hotPath: true, ftsColumns: ["content"], compoundDetailKey: false },
  poll: { hotPath: true, ftsColumns: ["title", "description"], compoundDetailKey: false },
  "poll-option": { hotPath: true, ftsColumns: ["label"], compoundDetailKey: false },
  "poll-vote": { hotPath: true, ftsColumns: ["comment"], compoundDetailKey: false },
  acknowledgement: { hotPath: true, ftsColumns: ["message"], compoundDetailKey: false },

  // ── journal document ──────────────────────────────────────────────
  "journal-entry": { hotPath: false, ftsColumns: ["title"], compoundDetailKey: false },
  "wiki-page": { hotPath: false, ftsColumns: ["title"], compoundDetailKey: false },
  note: { hotPath: false, ftsColumns: ["title", "content"], compoundDetailKey: false },

  // ── privacy-config document ───────────────────────────────────────
  bucket: { hotPath: false, ftsColumns: ["name", "description"], compoundDetailKey: false },
  "bucket-content-tag": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "friend-connection": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "friend-code": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "key-grant": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
  "field-bucket-visibility": { hotPath: false, ftsColumns: [], compoundDetailKey: false },
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
