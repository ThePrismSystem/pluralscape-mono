import type { SyncedEntityType } from "../strategies/crdt-strategies.js";

/**
 * Behaviour metadata for a materialized entity type — the parts of
 * the legacy `EntityTableDef` that don't live in the Drizzle schema.
 *
 * `hotPath` and `compoundDetailKey` drive query-invalidation routing
 * in the mobile app. `ftsColumns` is the list of columns indexed by
 * the FTS5 virtual table for full-text search; an empty array means
 * the entity has no FTS index. `friendExportable` declares whether
 * the entity replicates to a friend's local cache.
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
  /**
   * Entities whose data is shared with friends; the materializer emits
   * `friend_<table>` mirror tables for these and the friend indexer
   * walks them when re-indexing an inbound friend export.
   */
  readonly friendExportable: boolean;
}

/**
 * Per-entity-type behaviour metadata. Drives query-invalidation routing
 * (`hotPath`, `compoundDetailKey`), search-index generation (`ftsColumns`),
 * and friend-export wiring (`friendExportable`).
 */
export const ENTITY_METADATA = {
  // ── system-core document ──────────────────────────────────────────
  system: {
    hotPath: false,
    ftsColumns: ["name", "display_name", "description"],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "system-settings": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  member: {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "member-photo": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: true,
  },
  group: {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "group-membership": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "structure-entity-type": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "structure-entity": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "structure-entity-link": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "structure-entity-member-link": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "structure-entity-association": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  relationship: {
    hotPath: false,
    ftsColumns: ["label"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "custom-front": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "fronting-report": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "field-definition": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "field-value": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "innerworld-entity": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "innerworld-region": {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "innerworld-canvas": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  timer: { hotPath: false, ftsColumns: [], compoundDetailKey: false, friendExportable: false },
  "lifecycle-event": {
    hotPath: false,
    ftsColumns: ["notes"],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "webhook-config": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },

  // ── fronting document ─────────────────────────────────────────────
  "fronting-session": {
    hotPath: true,
    ftsColumns: ["comment"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "fronting-comment": {
    hotPath: true,
    ftsColumns: ["content"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "check-in-record": {
    hotPath: true,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },

  // ── chat document ─────────────────────────────────────────────────
  channel: {
    hotPath: true,
    ftsColumns: ["name"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  message: {
    hotPath: true,
    ftsColumns: ["content"],
    compoundDetailKey: true,
    friendExportable: true,
  },
  "board-message": {
    hotPath: true,
    ftsColumns: ["content"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  poll: {
    hotPath: true,
    ftsColumns: ["title", "description"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "poll-option": {
    hotPath: true,
    ftsColumns: ["label"],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "poll-vote": {
    hotPath: true,
    ftsColumns: ["comment"],
    compoundDetailKey: false,
    friendExportable: false,
  },
  acknowledgement: {
    hotPath: true,
    ftsColumns: ["message"],
    compoundDetailKey: false,
    friendExportable: true,
  },

  // ── journal document ──────────────────────────────────────────────
  "journal-entry": {
    hotPath: false,
    ftsColumns: ["title"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  "wiki-page": {
    hotPath: false,
    ftsColumns: ["title"],
    compoundDetailKey: false,
    friendExportable: true,
  },
  note: {
    hotPath: false,
    ftsColumns: ["title", "content"],
    compoundDetailKey: false,
    friendExportable: true,
  },

  // ── privacy-config document ───────────────────────────────────────
  bucket: {
    hotPath: false,
    ftsColumns: ["name", "description"],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "bucket-content-tag": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "friend-connection": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "friend-code": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "key-grant": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
  "field-bucket-visibility": {
    hotPath: false,
    ftsColumns: [],
    compoundDetailKey: false,
    friendExportable: false,
  },
} as const satisfies Record<SyncedEntityType, EntityMetadata>;

/**
 * Entity types whose data is shared with friends. Derived from the
 * `friendExportable` flag in `ENTITY_METADATA`. Used by local-schema
 * (friend_ table generation), friend-indexer (re-indexing), and search
 * (friend scope queries).
 */
export const FRIEND_EXPORTABLE_ENTITY_TYPES: ReadonlySet<SyncedEntityType> = new Set(
  (Object.keys(ENTITY_METADATA) as (keyof typeof ENTITY_METADATA)[]).filter(
    (entityType) => ENTITY_METADATA[entityType].friendExportable,
  ),
);
