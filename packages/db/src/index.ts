// @pluralscape/db — Drizzle schema (PostgreSQL + SQLite)

// ── Deployment ────────────────────────────────────────────────
export { getDeploymentMode } from "./deployment.js";
export type { DeploymentMode, SelfHostedMode } from "./deployment.js";

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
  applyAllRls,
  dropPolicySql,
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
export type { RlsExecutor, RlsScopeType, RlsTableName } from "./rls/index.js";

// ── Client ─────────────────────────────────────────────────────
export { createDatabase, createDatabaseFromEnv } from "./client/factory.js";
export type { PgConfig, PgPoolOptions, SqliteConfig, DatabaseConfig } from "./client/factory.js";
export type {
  Closeable,
  DatabaseClient,
  PgDatabaseClient,
  SqliteDatabaseClient,
} from "./client/types.js";

// ── Helpers ────────────────────────────────────────────────────
export {
  KNOWN_SATURATION_LEVELS,
  RELATIONSHIP_TYPES,
  FIELD_DEFINITION_SCOPE_TYPES,
  FRIEND_CONNECTION_STATUSES,
  AUTH_KEY_TYPES,
  DEVICE_TRANSFER_STATUSES,
  SYNC_DOC_TYPES,
  SYNC_KEY_TYPES,
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
  IMPORT_ENTITY_TYPES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  ACCOUNT_PURGE_STATUSES,
  SEARCHABLE_ENTITY_TYPES,
  JOB_TYPES,
  JOB_STATUSES,
  ROTATION_STATES,
  ROTATION_ITEM_STATUSES,
  ENTITY_TYPES,
  FRONTING_REPORT_FORMATS,
  BUCKET_CONTENT_ENTITY_TYPES,
} from "./helpers/index.js";
export type { BucketContentEntityType } from "@pluralscape/types";
export type { DbAuditActor } from "./helpers/index.js";

// ── Constants ────────────────────────────────────────────────
export {
  AUDIT_LOG_RETENTION_DAYS,
  PG_POOL_CONNECT_TIMEOUT_SECONDS,
  PG_POOL_IDLE_TIMEOUT_SECONDS,
  PG_POOL_MAX_CONNECTIONS,
  PG_POOL_MAX_LIFETIME_SECONDS,
} from "./helpers/db.constants.js";

// ── Queries (Job Helpers) ─────────────────────────────────────
export type { CleanupResult } from "./queries/index.js";
export {
  pgCleanupAuditLog,
  sqliteCleanupAuditLog,
  pgCleanupOrphanedTags,
  pgCleanupAllOrphanedTags,
  sqliteCleanupOrphanedTags,
  sqliteCleanupAllOrphanedTags,
  pgCleanupDeviceTransfers,
  sqliteCleanupDeviceTransfers,
} from "./queries/index.js";

// ── Views / Query Helpers ─────────────────────────────────────
export { pgViews, sqliteViews, mapStructureEntityAssociationRow } from "./views/index.js";
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
  StructureEntityAssociationRow,
  UnconfirmedAcknowledgement,
} from "./views/index.js";
