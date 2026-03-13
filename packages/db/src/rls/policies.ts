/**
 * PostgreSQL Row-Level Security policy generators.
 *
 * Each function returns raw SQL strings for creating RLS policies.
 * These are applied at migration time or via setup scripts — not at runtime.
 */

/** Policy scoping type for each table. */
export type RlsScopeType =
  | "system"
  | "account"
  | "system-pk"
  | "account-pk"
  | "dual"
  | "join-system"
  | "join-system-chained";

/**
 * Returns a SQL expression for reading a GUC variable fail-closed.
 * - `missing_ok = true` prevents errors when the variable is unset.
 * - `NULLIF(..., '')` converts empty string to NULL, causing the comparison to fail.
 * Combined, an unset or empty variable will never match any row.
 */
function currentSettingSql(gucKey: string): string {
  return `NULLIF(current_setting('${gucKey}', true), '')::varchar`;
}

/**
 * Generates ENABLE ROW LEVEL SECURITY + FORCE for a table.
 * FORCE ensures policies apply even to the table owner (important for PGlite tests).
 * Returns an array of individual SQL statements.
 */
export function enableRls(tableName: string): string[] {
  return [
    `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`,
  ];
}

/**
 * Creates an RLS policy scoped to system_id (or a custom column) via session variable.
 * Defaults to `system_id` column; pass `idColumn = "id"` for PK tables like `systems`.
 */
export function systemRlsPolicy(tableName: string, idColumn = "system_id"): string {
  const policyName = `${tableName}_system_isolation`;
  const setting = currentSettingSql("app.current_system_id");
  return `CREATE POLICY ${policyName} ON ${tableName} USING (${idColumn} = ${setting}) WITH CHECK (${idColumn} = ${setting})`;
}

/**
 * Creates an RLS policy scoped to account_id (or a custom column) via session variable.
 * Defaults to `account_id` column; pass `idColumn = "id"` for PK tables like `accounts`.
 */
export function accountRlsPolicy(tableName: string, idColumn = "account_id"): string {
  const policyName = `${tableName}_account_isolation`;
  const setting = currentSettingSql("app.current_account_id");
  return `CREATE POLICY ${policyName} ON ${tableName} USING (${idColumn} = ${setting}) WITH CHECK (${idColumn} = ${setting})`;
}

/**
 * Creates an RLS policy for dual-column tables (both account_id + system_id).
 * Used for tables like api_keys and audit_log.
 */
export function dualTenantRlsPolicy(tableName: string): string {
  const system = currentSettingSql("app.current_system_id");
  const account = currentSettingSql("app.current_account_id");
  return (
    `CREATE POLICY ${tableName}_tenant_isolation ON ${tableName} ` +
    `USING (account_id = ${account} AND system_id = ${system}) ` +
    `WITH CHECK (account_id = ${account} AND system_id = ${system})`
  );
}

/**
 * Creates an RLS policy for join tables that lack a direct tenant column.
 * Verifies ownership via EXISTS subquery against a parent table's system_id.
 */
export function joinSystemRlsPolicy(
  tableName: string,
  parentTable: string,
  joinColumn: string,
): string {
  const setting = currentSettingSql("app.current_system_id");
  const exists = `EXISTS (SELECT 1 FROM ${parentTable} WHERE ${parentTable}.id = ${tableName}.${joinColumn} AND ${parentTable}.system_id = ${setting})`;
  return `CREATE POLICY ${tableName}_system_isolation ON ${tableName} USING (${exists}) WITH CHECK (${exists})`;
}

/**
 * Creates an RLS policy for tables two hops from a tenant column.
 * Verifies ownership via a JOIN through an intermediate table to reach system_id.
 */
export function chainedJoinSystemRlsPolicy(
  tableName: string,
  intermediateTable: string,
  joinColumn: string,
  parentTable: string,
  intermediateJoinColumn: string,
): string {
  const setting = currentSettingSql("app.current_system_id");
  const exists =
    `EXISTS (SELECT 1 FROM ${intermediateTable} ` +
    `JOIN ${parentTable} ON ${parentTable}.id = ${intermediateTable}.${intermediateJoinColumn} ` +
    `WHERE ${intermediateTable}.id = ${tableName}.${joinColumn} ` +
    `AND ${parentTable}.system_id = ${setting})`;
  return `CREATE POLICY ${tableName}_system_isolation ON ${tableName} USING (${exists}) WITH CHECK (${exists})`;
}

/** Configuration for join-based RLS tables: maps table name to parent table and join column. */
const JOIN_SYSTEM_CONFIG: Readonly<Record<string, { parentTable: string; joinColumn: string }>> = {
  key_grants: { parentTable: "buckets", joinColumn: "bucket_id" },
  bucket_content_tags: { parentTable: "buckets", joinColumn: "bucket_id" },
  friend_bucket_assignments: {
    parentTable: "friend_connections",
    joinColumn: "friend_connection_id",
  },
  field_bucket_visibility: { parentTable: "field_definitions", joinColumn: "field_definition_id" },
  bucket_key_rotations: { parentTable: "buckets", joinColumn: "bucket_id" },
};

/**
 * Configuration for chained join-based RLS tables: tables that require a two-hop
 * join to reach a tenant column (e.g. rotation_items → rotations → buckets).
 */
const CHAINED_JOIN_CONFIG: Readonly<
  Record<
    string,
    {
      intermediateTable: string;
      joinColumn: string;
      parentTable: string;
      intermediateJoinColumn: string;
    }
  >
> = {
  bucket_rotation_items: {
    intermediateTable: "bucket_key_rotations",
    joinColumn: "rotation_id",
    parentTable: "buckets",
    intermediateJoinColumn: "bucket_id",
  },
};

/**
 * Map of every RLS-enabled table to its policy scope type.
 * All tables with tenant data are covered — no table relies solely on FK cascades.
 */
export const RLS_TABLE_POLICIES = {
  // Account-scoped (account_id column)
  auth_keys: "account",
  sessions: "account",
  recovery_keys: "account",
  device_transfer_requests: "account",

  // Special PK tables
  accounts: "account-pk",
  systems: "system-pk",
  nomenclature_settings: "system-pk",
  system_settings: "system-pk",
  innerworld_canvas: "system-pk",

  // Dual-column tables (account_id + system_id)
  api_keys: "dual",
  audit_log: "dual",
  device_tokens: "dual",

  // Join tables (no direct tenant column — verified via parent)
  key_grants: "join-system",
  bucket_content_tags: "join-system",
  friend_bucket_assignments: "join-system",
  field_bucket_visibility: "join-system",
  bucket_key_rotations: "join-system",
  bucket_rotation_items: "join-system-chained",

  // System-scoped (system_id column)
  members: "system",
  member_photos: "system",
  fronting_sessions: "system",
  switches: "system",
  custom_fronts: "system",
  fronting_reports: "system",
  fronting_comments: "system",
  journal_entries: "system",
  wiki_pages: "system",
  channels: "system",
  messages: "system",
  board_messages: "system",
  notes: "system",
  polls: "system",
  poll_votes: "system",
  acknowledgements: "system",
  buckets: "system",
  friend_connections: "system",
  friend_codes: "system",
  groups: "system",
  group_memberships: "system",
  innerworld_regions: "system",
  innerworld_entities: "system",
  relationships: "system",
  subsystems: "system",
  side_systems: "system",
  layers: "system",
  subsystem_memberships: "system",
  side_system_memberships: "system",
  layer_memberships: "system",
  subsystem_layer_links: "system",
  subsystem_side_system_links: "system",
  side_system_layer_links: "system",
  field_definitions: "system",
  field_values: "system",
  lifecycle_events: "system",
  safe_mode_content: "system",
  pk_bridge_configs: "system",
  notification_configs: "system",
  friend_notification_preferences: "system",
  webhook_configs: "system",
  webhook_deliveries: "system",
  blob_metadata: "system",
  timer_configs: "system",
  check_in_records: "system",

  // Import/Export
  import_jobs: "dual",
  export_requests: "dual",
  account_purge_requests: "account",

  // Search
  search_index: "system",

  // Sync
  sync_documents: "system",
  sync_queue: "system",
  sync_conflicts: "system",
} as const satisfies Record<string, RlsScopeType>;

/** Type-safe table names that have RLS policies. */
export type RlsTableName = keyof typeof RLS_TABLE_POLICIES;

/**
 * Generates all RLS SQL statements (ENABLE + policy) for a given table.
 * Returns an array of SQL strings to execute sequentially.
 */
export function generateRlsStatements(tableName: string): string[] {
  const scopeType = (RLS_TABLE_POLICIES as Record<string, RlsScopeType>)[tableName];
  if (scopeType === undefined) {
    throw new Error(`No RLS policy defined for table '${tableName}'`);
  }

  const statements = [...enableRls(tableName)];

  switch (scopeType) {
    case "system":
      statements.push(systemRlsPolicy(tableName));
      break;
    case "account":
      statements.push(accountRlsPolicy(tableName));
      break;
    case "system-pk":
      if (tableName === "systems") {
        statements.push(systemRlsPolicy("systems", "id"));
      } else {
        statements.push(systemRlsPolicy(tableName));
      }
      break;
    case "account-pk":
      statements.push(accountRlsPolicy("accounts", "id"));
      break;
    case "dual":
      statements.push(dualTenantRlsPolicy(tableName));
      break;
    case "join-system": {
      const config = JOIN_SYSTEM_CONFIG[tableName];
      if (config === undefined) {
        throw new Error(`No join config for table '${tableName}'`);
      }
      statements.push(joinSystemRlsPolicy(tableName, config.parentTable, config.joinColumn));
      break;
    }
    case "join-system-chained": {
      const chainConfig = CHAINED_JOIN_CONFIG[tableName];
      if (chainConfig === undefined) {
        throw new Error(`No chained join config for table '${tableName}'`);
      }
      statements.push(
        chainedJoinSystemRlsPolicy(
          tableName,
          chainConfig.intermediateTable,
          chainConfig.joinColumn,
          chainConfig.parentTable,
          chainConfig.intermediateJoinColumn,
        ),
      );
      break;
    }
    default: {
      const _exhaustive: never = scopeType;
      throw new Error(`Unknown RLS scope type: ${_exhaustive as string}`);
    }
  }

  return statements;
}
