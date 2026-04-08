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
  | "account-fk";

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
 * FK-to-tenant column mappings for account-fk scoped tables.
 * Key: table name, Value: { fkColumn, fkTable, fkTenantColumn }
 */
const ACCOUNT_FK_MAPPING: Readonly<
  Record<string, { fkColumn: string; fkTable: string; fkTenantColumn: string }>
> = {
  biometric_tokens: { fkColumn: "session_id", fkTable: "sessions", fkTenantColumn: "account_id" },
};

/**
 * Creates an RLS policy scoped via a foreign key to a tenant-holding parent table.
 * Uses a subquery to verify the FK references a row belonging to the current tenant.
 */
export function accountFkRlsPolicy(
  tableName: string,
  fkColumn: string,
  fkTable: string,
  fkTenantColumn: string,
): string {
  const policyName = `${tableName}_account_isolation`;
  const setting = currentSettingSql("app.current_account_id");
  return (
    `CREATE POLICY ${policyName} ON ${tableName} ` +
    `USING (${fkColumn} IN (SELECT id FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting})) ` +
    `WITH CHECK (${fkColumn} IN (SELECT id FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting}))`
  );
}

/** Tables where system-pk scope uses `id` instead of `system_id`. */
const SYSTEM_PK_ID_COLUMN: Readonly<Record<string, string>> = { systems: "id" };

/** Tables where account-pk scope uses `id` instead of `account_id`. */
const ACCOUNT_PK_ID_COLUMN: Readonly<Record<string, string>> = { accounts: "id" };

/** Regex to extract policy name and table from CREATE POLICY statements. */
const CREATE_POLICY_RE = /^CREATE POLICY (\S+) ON (\S+) /;

/**
 * Returns a `DROP POLICY IF EXISTS ...` statement for a CREATE POLICY statement,
 * or `null` if the input is not a CREATE POLICY statement.
 */
export function dropPolicySql(stmt: string): string | null {
  const match = CREATE_POLICY_RE.exec(stmt);
  const policyName = match?.[1];
  const tableName = match?.[2];
  if (!policyName || !tableName) return null;
  return `DROP POLICY IF EXISTS ${policyName} ON ${tableName}`;
}

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

  // Account-scoped via FK (subquery through parent table)
  biometric_tokens: "account-fk",

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

  // System-scoped (denormalized system_id)
  key_grants: "system",
  bucket_content_tags: "system",
  friend_bucket_assignments: "system",
  field_bucket_visibility: "system",
  bucket_key_rotations: "system",
  bucket_rotation_items: "system",

  // System-scoped (system_id column)
  members: "system",
  member_photos: "system",
  fronting_sessions: "system",
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
  friend_connections: "account",
  friend_codes: "account",
  groups: "system",
  group_memberships: "system",
  innerworld_regions: "system",
  innerworld_entities: "system",
  relationships: "system",
  system_structure_entity_types: "system",
  system_structure_entities: "system",
  system_structure_entity_links: "system",
  system_structure_entity_member_links: "system",
  system_structure_entity_associations: "system",
  field_definitions: "system",
  field_definition_scopes: "system",
  field_values: "system",
  lifecycle_events: "system",
  safe_mode_content: "system",
  pk_bridge_configs: "system",
  notification_configs: "system",
  friend_notification_preferences: "account",
  system_snapshots: "system",
  webhook_configs: "system",
  webhook_deliveries: "system",
  blob_metadata: "system",
  timer_configs: "system",
  check_in_records: "system",

  // Import/Export
  import_jobs: "dual",
  import_entity_refs: "dual",
  export_requests: "dual",
  account_purge_requests: "account",

  // Search
  search_index: "system",

  // Sync — sync_changes and sync_snapshots lack system_id; access control
  // flows via FK to sync_documents which has system_id.
  sync_documents: "system",
} as const satisfies Record<string, RlsScopeType>;

/** Type-safe table names that have RLS policies. */
export type RlsTableName = keyof typeof RLS_TABLE_POLICIES;

/**
 * Generates all RLS SQL statements (ENABLE + policy) for a given table.
 * Returns an array of SQL strings to execute sequentially.
 */
export function generateRlsStatements(tableName: RlsTableName): string[] {
  const scopeType = RLS_TABLE_POLICIES[tableName];

  const statements = [...enableRls(tableName)];

  switch (scopeType) {
    case "system":
      statements.push(systemRlsPolicy(tableName));
      break;
    case "account":
      statements.push(accountRlsPolicy(tableName));
      break;
    case "system-pk":
      statements.push(systemRlsPolicy(tableName, SYSTEM_PK_ID_COLUMN[tableName] ?? "system_id"));
      break;
    case "account-pk":
      statements.push(accountRlsPolicy(tableName, ACCOUNT_PK_ID_COLUMN[tableName] ?? "account_id"));
      break;
    case "dual":
      statements.push(dualTenantRlsPolicy(tableName));
      break;
    case "account-fk": {
      const mapping = ACCOUNT_FK_MAPPING[tableName];
      if (!mapping) {
        throw new Error(`No FK mapping for account-fk table: ${tableName}`);
      }
      statements.push(
        accountFkRlsPolicy(tableName, mapping.fkColumn, mapping.fkTable, mapping.fkTenantColumn),
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
