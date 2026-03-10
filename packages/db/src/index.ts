// @pluralscape/db — Drizzle schema (PostgreSQL + SQLite)

// ── Dialect ────────────────────────────────────────────────────
export { getDialect, getDialectCapabilities, isPostgreSQL, isSQLite } from "./dialect.js";
export type { DbDialect, DialectCapabilities } from "./dialect.js";

// ── RLS ────────────────────────────────────────────────────────
export {
  accountRlsPolicy,
  accountScope,
  accountsTableRlsPolicy,
  enableRls,
  ENABLE_PGCRYPTO,
  generateRlsStatements,
  RLS_TABLE_POLICIES,
  setAccountId,
  setAccountIdSql,
  setSystemId,
  setSystemIdSql,
  setTenantContext,
  systemPkRlsPolicy,
  systemRlsPolicy,
  systemScope,
  systemsTableRlsPolicy,
} from "./rls/index.js";
export type { RlsScopeType } from "./rls/index.js";

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
  POLL_STATUSES,
  POLL_KINDS,
  INNERWORLD_ENTITY_TYPES,
  INNERWORLD_REGION_ACCESS_TYPES,
  PK_SYNC_DIRECTIONS,
} from "./helpers/index.js";
export type { DbAuditActor } from "./helpers/index.js";
