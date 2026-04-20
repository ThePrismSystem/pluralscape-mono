import { ENTITY_CRDT_STRATEGIES, type SyncedEntityType } from "../strategies/crdt-strategies.js";

// ── Column definition ────────────────────────────────────────────────

export interface ColumnDef {
  readonly name: string;
  readonly sqlType: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  readonly primaryKey?: boolean;
  readonly notNull?: boolean;
}

// ── Entity table definition ──────────────────────────────────────────

export interface EntityTableDef {
  readonly tableName: string;
  readonly columns: readonly ColumnDef[];
  readonly ftsColumns: readonly string[];
  /**
   * When true, materializing this entity type emits entity-level (hot path)
   * invalidation events. Used for fronting and chat entities where
   * low-latency UI updates are required.
   *
   * When false, document-level invalidation is emitted instead.
   */
  readonly hotPath: boolean;
  /**
   * When true, the React Query detail key for this entity type is NOT
   * shaped `[tableName, entityId]` — it embeds additional scoping slots
   * (e.g., `messages` uses `[tableName, channelId, entityId]`). Hot-path
   * document-level invalidation normally narrows to list queries only
   * (detail queries get covered by entity-level events whose key is
   * `[tableName, entityId]`). For compound detail keys that prefix
   * shortcut misses the detail, so the invalidator must fall back to
   * broad `[tableName]` invalidation on document events even when
   * `hotPath` is true.
   *
   * Consumed by the mobile query invalidator. Defaults to `false`.
   */
  readonly compoundDetailKey?: boolean;
}

// ── Shared column helpers ────────────────────────────────────────────

/** Primary key `id` column (TEXT NOT NULL). */
const id: ColumnDef = { name: "id", sqlType: "TEXT", primaryKey: true, notNull: true };

/** Foreign key `system_id` column (TEXT NOT NULL). */
const systemId: ColumnDef = { name: "system_id", sqlType: "TEXT", notNull: true };

/** Soft-delete flag `archived` column (INTEGER NOT NULL, stores boolean as 0/1). */
const archived: ColumnDef = { name: "archived", sqlType: "INTEGER", notNull: true };

/** `created_at` column (INTEGER NOT NULL, Unix ms timestamp). */
const createdAt: ColumnDef = { name: "created_at", sqlType: "INTEGER", notNull: true };

/** `updated_at` column (INTEGER NOT NULL, Unix ms timestamp). */
const updatedAt: ColumnDef = { name: "updated_at", sqlType: "INTEGER", notNull: true };

// ── Registry ─────────────────────────────────────────────────────────

/**
 * Maps every `SyncedEntityType` to its local SQLite table definition.
 *
 * Column naming convention: camelCase fields → snake_case columns.
 * JSON-serialized fields use a `_json` suffix.
 * Boolean and timestamp fields use INTEGER (SQLite has no native bool/datetime).
 */
export const ENTITY_TABLE_REGISTRY: Record<SyncedEntityType, EntityTableDef> = {
  // ── system-core document ──────────────────────────────────────────

  system: {
    tableName: "system",
    columns: [
      id,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "display_name", sqlType: "TEXT" },
      { name: "description", sqlType: "TEXT" },
      { name: "avatar_source", sqlType: "TEXT" },
      { name: "settings_id", sqlType: "TEXT", notNull: true },
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "display_name", "description"],
    hotPath: false,
  },

  "system-settings": {
    tableName: "system_settings",
    columns: [
      id,
      systemId,
      { name: "theme", sqlType: "TEXT", notNull: true },
      { name: "font_scale", sqlType: "REAL", notNull: true },
      { name: "locale", sqlType: "TEXT" },
      { name: "default_bucket_id", sqlType: "TEXT" },
      { name: "app_lock", sqlType: "TEXT", notNull: true },
      { name: "notifications", sqlType: "TEXT", notNull: true },
      { name: "sync_preferences", sqlType: "TEXT", notNull: true },
      { name: "privacy_defaults", sqlType: "TEXT", notNull: true },
      { name: "littles_safe_mode", sqlType: "TEXT", notNull: true },
      { name: "nomenclature", sqlType: "TEXT", notNull: true },
      { name: "saturation_levels_enabled", sqlType: "INTEGER", notNull: true },
      { name: "auto_capture_fronting_on_journal", sqlType: "INTEGER", notNull: true },
      { name: "snapshot_schedule", sqlType: "TEXT", notNull: true },
      { name: "onboarding_complete", sqlType: "INTEGER", notNull: true },
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  member: {
    tableName: "members",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "pronouns", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "avatar_source", sqlType: "TEXT" },
      { name: "colors", sqlType: "TEXT", notNull: true },
      { name: "saturation_level", sqlType: "TEXT", notNull: true },
      { name: "tags", sqlType: "TEXT", notNull: true },
      { name: "suppress_friend_front_notification", sqlType: "INTEGER", notNull: true },
      { name: "board_message_notification_on_front", sqlType: "INTEGER", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "member-photo": {
    tableName: "member_photos",
    columns: [
      id,
      { name: "member_id", sqlType: "TEXT", notNull: true },
      { name: "image_source", sqlType: "TEXT", notNull: true },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      { name: "caption", sqlType: "TEXT" },
      archived,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  group: {
    tableName: "groups",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "parent_group_id", sqlType: "TEXT" },
      { name: "image_source", sqlType: "TEXT" },
      { name: "color", sqlType: "TEXT" },
      { name: "emoji", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "structure-entity-type": {
    tableName: "structure_entity_types",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "color", sqlType: "TEXT" },
      { name: "image_source", sqlType: "TEXT" },
      { name: "emoji", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "structure-entity": {
    tableName: "structure_entities",
    columns: [
      id,
      systemId,
      { name: "entity_type_id", sqlType: "TEXT", notNull: true },
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "color", sqlType: "TEXT" },
      { name: "image_source", sqlType: "TEXT" },
      { name: "emoji", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  relationship: {
    tableName: "relationships",
    columns: [
      id,
      systemId,
      { name: "source_member_id", sqlType: "TEXT", notNull: true },
      { name: "target_member_id", sqlType: "TEXT", notNull: true },
      { name: "type", sqlType: "TEXT", notNull: true },
      { name: "label", sqlType: "TEXT" },
      { name: "bidirectional", sqlType: "INTEGER", notNull: true },
      { name: "created_at", sqlType: "INTEGER", notNull: true },
      archived,
    ],
    ftsColumns: ["label"],
    hotPath: false,
  },

  "custom-front": {
    tableName: "custom_fronts",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "color", sqlType: "TEXT" },
      { name: "emoji", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "fronting-report": {
    tableName: "fronting_reports",
    columns: [
      id,
      systemId,
      { name: "encrypted_data", sqlType: "TEXT", notNull: true },
      { name: "format", sqlType: "TEXT", notNull: true },
      { name: "generated_at", sqlType: "INTEGER", notNull: true },
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "field-definition": {
    tableName: "field_definitions",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "field_type", sqlType: "TEXT", notNull: true },
      { name: "options", sqlType: "TEXT" },
      { name: "required", sqlType: "INTEGER", notNull: true },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      { name: "scopes", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "field-value": {
    tableName: "field_values",
    columns: [
      id,
      { name: "field_definition_id", sqlType: "TEXT", notNull: true },
      { name: "member_id", sqlType: "TEXT" },
      { name: "structure_entity_id", sqlType: "TEXT" },
      { name: "group_id", sqlType: "TEXT" },
      { name: "value", sqlType: "TEXT", notNull: true },
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "innerworld-entity": {
    tableName: "innerworld_entities",
    columns: [
      id,
      systemId,
      { name: "entity_type", sqlType: "TEXT", notNull: true },
      { name: "position_x", sqlType: "REAL", notNull: true },
      { name: "position_y", sqlType: "REAL", notNull: true },
      { name: "visual", sqlType: "TEXT", notNull: true },
      { name: "region_id", sqlType: "TEXT" },
      { name: "linked_member_id", sqlType: "TEXT" },
      { name: "linked_structure_entity_id", sqlType: "TEXT" },
      { name: "name", sqlType: "TEXT" },
      { name: "description", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "innerworld-region": {
    tableName: "innerworld_regions",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "parent_region_id", sqlType: "TEXT" },
      { name: "visual", sqlType: "TEXT", notNull: true },
      { name: "boundary_data", sqlType: "TEXT", notNull: true },
      { name: "access_type", sqlType: "TEXT", notNull: true },
      { name: "gatekeeper_member_ids", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "innerworld-canvas": {
    tableName: "innerworld_canvas",
    columns: [
      id,
      systemId,
      { name: "encrypted_data", sqlType: "BLOB", notNull: true },
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  timer: {
    tableName: "timers",
    columns: [
      id,
      systemId,
      { name: "interval_minutes", sqlType: "INTEGER" },
      { name: "waking_hours_only", sqlType: "INTEGER" },
      { name: "waking_start", sqlType: "TEXT" },
      { name: "waking_end", sqlType: "TEXT" },
      { name: "prompt_text", sqlType: "TEXT", notNull: true },
      { name: "enabled", sqlType: "INTEGER", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "lifecycle-event": {
    tableName: "lifecycle_events",
    columns: [
      id,
      systemId,
      { name: "event_type", sqlType: "TEXT", notNull: true },
      { name: "occurred_at", sqlType: "INTEGER", notNull: true },
      { name: "recorded_at", sqlType: "INTEGER", notNull: true },
      { name: "notes", sqlType: "TEXT" },
      { name: "payload", sqlType: "TEXT", notNull: true },
      archived,
    ],
    ftsColumns: ["notes"],
    hotPath: false,
  },

  "structure-entity-link": {
    tableName: "structure_entity_links",
    columns: [
      id,
      systemId,
      { name: "entity_id", sqlType: "TEXT", notNull: true },
      { name: "parent_entity_id", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "structure-entity-member-link": {
    tableName: "structure_entity_member_links",
    columns: [
      id,
      systemId,
      { name: "member_id", sqlType: "TEXT", notNull: true },
      { name: "parent_entity_id", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "structure-entity-association": {
    tableName: "structure_entity_associations",
    columns: [
      id,
      systemId,
      { name: "source_entity_id", sqlType: "TEXT", notNull: true },
      { name: "target_entity_id", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "webhook-config": {
    tableName: "webhook_configs",
    columns: [
      id,
      systemId,
      { name: "url", sqlType: "TEXT", notNull: true },
      { name: "event_types", sqlType: "TEXT", notNull: true },
      { name: "enabled", sqlType: "INTEGER", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "group-membership": {
    tableName: "group_memberships",
    columns: [
      id,
      { name: "group_id", sqlType: "TEXT", notNull: true },
      { name: "member_id", sqlType: "TEXT", notNull: true },
    ],
    ftsColumns: [],
    hotPath: false,
  },

  // ── fronting document (all hotPath: true) ────────────────────────

  "fronting-session": {
    tableName: "fronting_sessions",
    columns: [
      id,
      systemId,
      { name: "member_id", sqlType: "TEXT", notNull: false },
      { name: "start_time", sqlType: "INTEGER", notNull: true },
      { name: "end_time", sqlType: "INTEGER" },
      { name: "comment", sqlType: "TEXT" },
      { name: "custom_front_id", sqlType: "TEXT" },
      { name: "structure_entity_id", sqlType: "TEXT" },
      { name: "positionality", sqlType: "TEXT" },
      { name: "outtrigger", sqlType: "TEXT" },
      { name: "outtrigger_sentiment", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["comment"],
    hotPath: true,
  },

  "fronting-comment": {
    tableName: "fronting_comments",
    columns: [
      id,
      { name: "fronting_session_id", sqlType: "TEXT", notNull: true },
      systemId,
      { name: "member_id", sqlType: "TEXT" },
      { name: "custom_front_id", sqlType: "TEXT" },
      { name: "structure_entity_id", sqlType: "TEXT" },
      { name: "content", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["content"],
    hotPath: true,
  },

  "check-in-record": {
    tableName: "check_in_records",
    columns: [
      id,
      { name: "timer_config_id", sqlType: "TEXT", notNull: true },
      systemId,
      { name: "scheduled_at", sqlType: "INTEGER", notNull: true },
      { name: "responded_by_member_id", sqlType: "TEXT" },
      { name: "responded_at", sqlType: "INTEGER" },
      { name: "dismissed", sqlType: "INTEGER", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: true,
  },

  // ── chat document (all hotPath: true) ────────────────────────────

  channel: {
    tableName: "channels",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "type", sqlType: "TEXT", notNull: true },
      { name: "parent_id", sqlType: "TEXT" },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name"],
    hotPath: true,
  },

  message: {
    tableName: "messages",
    columns: [
      id,
      { name: "channel_id", sqlType: "TEXT", notNull: true },
      systemId,
      { name: "sender_id", sqlType: "TEXT", notNull: true },
      { name: "content", sqlType: "TEXT", notNull: true },
      { name: "attachments", sqlType: "TEXT", notNull: true },
      { name: "mentions", sqlType: "TEXT", notNull: true },
      { name: "reply_to_id", sqlType: "TEXT" },
      { name: "timestamp", sqlType: "INTEGER", notNull: true },
      { name: "edit_of", sqlType: "TEXT" },
      archived,
    ],
    ftsColumns: ["content"],
    hotPath: true,
    // `useMessage` keys details as `["messages", channelId, messageId]`
    // (see apps/mobile/src/hooks/use-messages.ts). The hot-path narrowing
    // optimization assumes detail keys are `[tableName, entityId]` and
    // relies on per-entity events to cover them, but that shape doesn't
    // prefix-match this compound key. Opt out of narrowing so document
    // events broadly invalidate the `messages` table and keep details
    // fresh.
    compoundDetailKey: true,
  },

  "board-message": {
    tableName: "board_messages",
    columns: [
      id,
      systemId,
      { name: "sender_id", sqlType: "TEXT", notNull: true },
      { name: "content", sqlType: "TEXT", notNull: true },
      { name: "pinned", sqlType: "INTEGER", notNull: true },
      { name: "sort_order", sqlType: "REAL", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["content"],
    hotPath: true,
  },

  poll: {
    tableName: "polls",
    columns: [
      id,
      systemId,
      { name: "created_by_member_id", sqlType: "TEXT", notNull: true },
      { name: "title", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      { name: "kind", sqlType: "TEXT", notNull: true },
      { name: "status", sqlType: "TEXT", notNull: true },
      { name: "closed_at", sqlType: "INTEGER" },
      { name: "ends_at", sqlType: "INTEGER" },
      { name: "allow_multiple_votes", sqlType: "INTEGER", notNull: true },
      { name: "max_votes_per_member", sqlType: "INTEGER", notNull: true },
      { name: "allow_abstain", sqlType: "INTEGER", notNull: true },
      { name: "allow_veto", sqlType: "INTEGER", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["title", "description"],
    hotPath: true,
  },

  "poll-option": {
    tableName: "poll_options",
    columns: [
      id,
      { name: "poll_id", sqlType: "TEXT", notNull: true },
      { name: "label", sqlType: "TEXT", notNull: true },
      { name: "color", sqlType: "TEXT" },
      { name: "emoji", sqlType: "TEXT" },
    ],
    ftsColumns: ["label"],
    hotPath: true,
  },

  "poll-vote": {
    tableName: "poll_votes",
    columns: [
      id,
      { name: "poll_id", sqlType: "TEXT", notNull: true },
      { name: "option_id", sqlType: "TEXT" },
      { name: "voter", sqlType: "TEXT", notNull: true },
      { name: "comment", sqlType: "TEXT" },
      { name: "is_veto", sqlType: "INTEGER", notNull: true },
      { name: "voted_at", sqlType: "INTEGER", notNull: true },
      archived,
    ],
    ftsColumns: ["comment"],
    hotPath: true,
  },

  acknowledgement: {
    tableName: "acknowledgements",
    columns: [
      id,
      systemId,
      { name: "created_by_member_id", sqlType: "TEXT", notNull: true },
      { name: "target_member_id", sqlType: "TEXT", notNull: true },
      { name: "message", sqlType: "TEXT", notNull: true },
      { name: "confirmed", sqlType: "INTEGER", notNull: true },
      { name: "confirmed_at", sqlType: "INTEGER" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["message"],
    hotPath: true,
  },

  // ── journal document ─────────────────────────────────────────────

  "journal-entry": {
    tableName: "journal_entries",
    columns: [
      id,
      systemId,
      { name: "author", sqlType: "TEXT" },
      { name: "fronting_session_id", sqlType: "TEXT" },
      { name: "title", sqlType: "TEXT", notNull: true },
      { name: "blocks", sqlType: "TEXT", notNull: true },
      { name: "tags", sqlType: "TEXT", notNull: true },
      { name: "linked_entities", sqlType: "TEXT", notNull: true },
      { name: "fronting_snapshots", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["title"],
    hotPath: false,
  },

  "wiki-page": {
    tableName: "wiki_pages",
    columns: [
      id,
      systemId,
      { name: "title", sqlType: "TEXT", notNull: true },
      { name: "slug", sqlType: "TEXT", notNull: true },
      { name: "blocks", sqlType: "TEXT", notNull: true },
      { name: "linked_from_pages", sqlType: "TEXT", notNull: true },
      { name: "tags", sqlType: "TEXT", notNull: true },
      { name: "linked_entities", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["title"],
    hotPath: false,
  },

  note: {
    tableName: "notes",
    columns: [
      id,
      systemId,
      { name: "author_entity_type", sqlType: "TEXT" },
      { name: "author_entity_id", sqlType: "TEXT" },
      { name: "title", sqlType: "TEXT", notNull: true },
      { name: "content", sqlType: "TEXT", notNull: true },
      { name: "background_color", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["title", "content"],
    hotPath: false,
  },

  // ── privacy-config document ──────────────────────────────────────

  bucket: {
    tableName: "buckets",
    columns: [
      id,
      systemId,
      { name: "name", sqlType: "TEXT", notNull: true },
      { name: "description", sqlType: "TEXT" },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: ["name", "description"],
    hotPath: false,
  },

  "bucket-content-tag": {
    tableName: "bucket_content_tags",
    columns: [
      id,
      { name: "entity_type", sqlType: "TEXT", notNull: true },
      { name: "entity_id", sqlType: "TEXT", notNull: true },
      { name: "bucket_id", sqlType: "TEXT", notNull: true },
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "friend-connection": {
    tableName: "friend_connections",
    columns: [
      id,
      { name: "account_id", sqlType: "TEXT", notNull: true },
      { name: "friend_account_id", sqlType: "TEXT", notNull: true },
      { name: "status", sqlType: "TEXT", notNull: true },
      { name: "assigned_buckets", sqlType: "TEXT", notNull: true },
      { name: "visibility", sqlType: "TEXT", notNull: true },
      archived,
      createdAt,
      updatedAt,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "friend-code": {
    tableName: "friend_codes",
    columns: [
      id,
      { name: "account_id", sqlType: "TEXT", notNull: true },
      { name: "code", sqlType: "TEXT", notNull: true },
      { name: "created_at", sqlType: "INTEGER", notNull: true },
      { name: "expires_at", sqlType: "INTEGER" },
      archived,
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "key-grant": {
    tableName: "key_grants",
    columns: [
      id,
      { name: "bucket_id", sqlType: "TEXT", notNull: true },
      { name: "friend_account_id", sqlType: "TEXT", notNull: true },
      { name: "encrypted_bucket_key", sqlType: "TEXT", notNull: true },
      { name: "key_version", sqlType: "INTEGER", notNull: true },
      { name: "created_at", sqlType: "INTEGER", notNull: true },
      { name: "revoked_at", sqlType: "INTEGER" },
    ],
    ftsColumns: [],
    hotPath: false,
  },

  "field-bucket-visibility": {
    tableName: "field_bucket_visibilities",
    columns: [
      id,
      { name: "field_definition_id", sqlType: "TEXT", notNull: true },
      { name: "bucket_id", sqlType: "TEXT", notNull: true },
    ],
    ftsColumns: [],
    hotPath: false,
  },
} as const;

// ── Lookup helpers ────────────────────────────────────────────────────

/**
 * Returns the table definition for a given entity type.
 *
 * @param entityType - A valid `SyncedEntityType` key.
 */
export function getTableDef(entityType: SyncedEntityType): EntityTableDef {
  return ENTITY_TABLE_REGISTRY[entityType];
}

/**
 * Returns all entity types that belong to a given document type.
 *
 * Uses a static import of `ENTITY_CRDT_STRATEGIES` to filter entries by
 * their `document` field. Returns an empty array for unknown document types.
 *
 * @param documentType - A `SyncDocumentType` string (e.g., "system-core").
 */
export function getEntityTypesForDocument(documentType: string): SyncedEntityType[] {
  return (Object.keys(ENTITY_CRDT_STRATEGIES) as SyncedEntityType[]).filter(
    (entityType) => ENTITY_CRDT_STRATEGIES[entityType].document === documentType,
  );
}

/**
 * Entity types whose data is shared with friends. Used by local-schema
 * (friend_ table generation), friend-indexer (re-indexing), and search
 * (friend scope queries).
 */
export const FRIEND_EXPORTABLE_ENTITY_TYPES = new Set<SyncedEntityType>([
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
