/**
 * PostgreSQL Row-Level Security policy generators.
 *
 * Each function returns raw SQL strings for creating RLS policies.
 * These are applied at migration time or via setup scripts — not at runtime.
 */

/** Policy scoping type for each table. */
export type RlsScopeType = "system" | "account" | "system-pk" | "account-pk";

/**
 * Generates ENABLE ROW LEVEL SECURITY + FORCE for a table.
 * FORCE ensures policies apply even to the table owner (important for PGlite tests).
 */
export function enableRls(tableName: string): string {
  return [
    `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`,
  ].join(";\n");
}

/**
 * Creates an RLS policy scoped to system_id via session variable.
 * Applies to tables where system_id is a regular column.
 */
export function systemRlsPolicy(tableName: string): string {
  const policyName = `${tableName}_system_isolation`;
  return `CREATE POLICY ${policyName} ON ${tableName} USING (system_id = current_setting('app.current_system_id')::varchar) WITH CHECK (system_id = current_setting('app.current_system_id')::varchar)`;
}

/**
 * Creates an RLS policy for tables where the primary key IS the system_id.
 * Used for 1:1 tables like nomenclature_settings, system_settings, innerworld_canvas.
 */
export function systemPkRlsPolicy(tableName: string): string {
  const policyName = `${tableName}_system_isolation`;
  return `CREATE POLICY ${policyName} ON ${tableName} USING (system_id = current_setting('app.current_system_id')::varchar) WITH CHECK (system_id = current_setting('app.current_system_id')::varchar)`;
}

/**
 * Creates an RLS policy scoped to account_id via session variable.
 * Applies to account-level tables (auth_keys, sessions, etc.).
 */
export function accountRlsPolicy(tableName: string): string {
  const policyName = `${tableName}_account_isolation`;
  return `CREATE POLICY ${policyName} ON ${tableName} USING (account_id = current_setting('app.current_account_id')::varchar) WITH CHECK (account_id = current_setting('app.current_account_id')::varchar)`;
}

/**
 * Creates an RLS policy for the systems table itself.
 * Uses `id` column instead of `system_id`.
 */
export function systemsTableRlsPolicy(): string {
  return `CREATE POLICY systems_system_isolation ON systems USING (id = current_setting('app.current_system_id')::varchar) WITH CHECK (id = current_setting('app.current_system_id')::varchar)`;
}

/**
 * Creates an RLS policy for the accounts table itself.
 * Uses `id` column instead of `account_id`.
 */
export function accountsTableRlsPolicy(): string {
  return `CREATE POLICY accounts_account_isolation ON accounts USING (id = current_setting('app.current_account_id')::varchar) WITH CHECK (id = current_setting('app.current_account_id')::varchar)`;
}

/**
 * Map of every RLS-enabled table to its policy scope type.
 *
 * Tables not in this map either:
 * - Have no direct tenant column (bucket_content_tags, friend_bucket_assignments)
 *   and are protected via FK cascades from parent tables that DO have RLS.
 * - Need dual-column policies (api_keys, audit_log) handled separately.
 */
export const RLS_TABLE_POLICIES: Record<string, RlsScopeType> = {
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

  // System-scoped (system_id column)
  members: "system",
  member_photos: "system",
  fronting_sessions: "system",
  switches: "system",
  custom_fronts: "system",
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
  key_grants: "system",
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
  pk_bridge_state: "system",
} as const;

/**
 * Generates all RLS SQL statements (ENABLE + policy) for a given table.
 * Returns an array of SQL strings to execute sequentially.
 */
export function generateRlsStatements(tableName: string): string[] {
  const scopeType = RLS_TABLE_POLICIES[tableName];
  if (scopeType === undefined) {
    throw new Error(`No RLS policy defined for table '${tableName}'`);
  }

  const statements = [enableRls(tableName)];

  switch (scopeType) {
    case "system":
      statements.push(systemRlsPolicy(tableName));
      break;
    case "account":
      statements.push(accountRlsPolicy(tableName));
      break;
    case "system-pk":
      if (tableName === "systems") {
        statements.push(systemsTableRlsPolicy());
      } else {
        statements.push(systemPkRlsPolicy(tableName));
      }
      break;
    case "account-pk":
      statements.push(accountsTableRlsPolicy());
      break;
  }

  return statements;
}
