// @pluralscape/db — Drizzle schema (PostgreSQL + SQLite)

// ── Dialect ────────────────────────────────────────────────────
export {
  ENABLE_PGCRYPTO,
  getDialect,
  getDialectCapabilities,
  isPostgreSQL,
  isSQLite,
} from "./dialect.js";
export type { DbDialect, DialectCapabilities } from "./dialect.js";

// ── RLS ────────────────────────────────────────────────────────
export {
  accountScope,
  enableRls,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  setAccountId,
  setAccountIdSql,
  setSystemId,
  setSystemIdSql,
  setTenantContext,
  systemScope,
} from "./rls/index.js";
export type { PgExecutor } from "./rls/index.js";
export type { RlsScopeType, RlsTableName } from "./rls/index.js";

// ── Client ─────────────────────────────────────────────────────
export { createDatabase, createDatabaseFromEnv } from "./client/factory.js";
export type { PgConfig, SqliteConfig, DatabaseConfig } from "./client/factory.js";
export type { DatabaseClient, PgDatabaseClient, SqliteDatabaseClient } from "./client/types.js";

// ── Helpers ────────────────────────────────────────────────────
export {
  KNOWN_SATURATION_LEVELS,
  FRONTING_TYPES,
  RELATIONSHIP_TYPES,
  LAYER_ACCESS_TYPES,
  FRIEND_CONNECTION_STATUSES,
  BUCKET_VISIBILITY_SCOPES,
  AUTH_KEY_TYPES,
  DEVICE_TRANSFER_STATUSES,
  SYNC_OPERATIONS,
  SYNC_RESOLUTIONS,
  API_KEY_KEY_TYPES,
  API_KEY_SCOPES,
  AUDIT_EVENT_TYPES,
  CHANNEL_TYPES,
  DISCOVERY_STATUSES,
  FIELD_TYPES,
  LIFECYCLE_EVENT_TYPES,
  POLL_STATUSES,
  POLL_KINDS,
  PK_SYNC_DIRECTIONS,
  DEVICE_TOKEN_PLATFORMS,
  NOTIFICATION_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_DELIVERY_STATUSES,
  BLOB_PURPOSES,
  IMPORT_SOURCES,
  IMPORT_JOB_STATUSES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  ACCOUNT_PURGE_STATUSES,
  SEARCHABLE_ENTITY_TYPES,
  JOB_TYPES,
  JOB_STATUSES,
  ROTATION_STATES,
  ROTATION_ITEM_STATUSES,
} from "./helpers/index.js";
export type { DbAuditActor } from "./helpers/index.js";

// ── Views / Query Helpers ─────────────────────────────────────
export { pgViews, sqliteViews, LINK_TYPES, mapStructureCrossLinkRow } from "./views/index.js";
export type {
  ActiveApiKey,
  ActiveDeviceToken,
  ActiveDeviceTransfer,
  ActiveFriendConnection,
  CurrentFronter,
  CurrentFronterWithDuration,
  CurrentFrontingComment,
  MemberGroupSummary,
  PendingFriendRequest,
  PendingWebhookRetry,
  StructureCrossLink,
  UnconfirmedAcknowledgement,
} from "./views/index.js";
