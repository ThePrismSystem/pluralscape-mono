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
  | "account-fk"
  | "system-fk"
  | "account-bidirectional"
  /**
   * systems table: combine the PK id check with account_id ownership so a
   * compromised `app.current_system_id` alone cannot unlock another account's
   * system row. Named `systems-pk-with-account` (not `systems-pk`) to avoid
   * confusion with the pre-existing generic `system-pk` scope. See audit
   * finding db-zy79.
   */
  | "systems-pk-with-account"
  /**
   * audit_log: NULL-aware dual-tenant USING + symmetric WITH CHECK. Rows
   * whose accountId or systemId were nullified by ON DELETE SET NULL (after
   * account/system deletion) must not be readable through normal tenant
   * context. Regular tenant rows still match `account_id =
   * current_account_id() AND system_id = current_system_id()`. WITH CHECK
   * mirrors USING (plus IS NOT NULL) so any future regression that attempts
   * to write NULL tenant columns is rejected up-front. See audit finding
   * db-dpp7.
   */
  | "audit-log-null-aware"
  /**
   * key_grants: two read paths. The owning system (which issued the grant)
   * reads via `system_id = current_system_id()`. Friends receiving the grant
   * read via `friend_account_id = current_account_id()` — they may not know
   * or be allowed to set the originating system's ID as their session
   * context. Writes remain restricted to the originating system.
   * See audit finding db-eigy.
   */
  | "key-grants";

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
 * Creates the systems PK policy combining `id = current_system_id()` with
 * `account_id = current_account_id()`. A session whose system GUC is set to
 * another tenant's system must NOT be able to read or write that system row
 * just because it happens to know the UUID. See audit finding db-zy79.
 */
export function systemsPkRlsPolicy(): string {
  const systemSetting = currentSettingSql("app.current_system_id");
  const accountSetting = currentSettingSql("app.current_account_id");
  return (
    `CREATE POLICY systems_system_isolation ON systems ` +
    `USING (id = ${systemSetting} AND account_id = ${accountSetting}) ` +
    `WITH CHECK (id = ${systemSetting} AND account_id = ${accountSetting})`
  );
}

/**
 * Creates the audit_log dual-tenant policy with NULL-awareness for rows
 * whose account_id or system_id were nullified by ON DELETE SET NULL.
 *
 * USING: regular tenant rows match when both GUCs equal the stored IDs.
 * Rows whose references were nullified (post account/system purge) are NOT
 * readable through this policy — accessing them requires an admin/forensic
 * path via a privileged database role that bypasses RLS (BYPASSRLS).
 *
 * Without the explicit NULL handling, rows with NULL tenant columns become
 * permanently invisible because `NULL = <anything>` evaluates to NULL (not
 * TRUE), which the USING clause filters out. That behavior is correct for
 * normal tenant isolation but the intent deserves an explicit comment.
 *
 * WITH CHECK mirrors USING, including the `IS NOT NULL` guard. Application
 * writes never insert NULL tenant columns — only the ON DELETE SET NULL
 * cascade produces them — so the guard is defensive. Should a future
 * regression attempt to write NULL tenant IDs through the tenant role, the
 * symmetric WITH CHECK will reject it up-front instead of producing a row
 * that is permanently invisible through tenant context.
 *
 * See audit finding db-dpp7.
 */
export function auditLogRlsPolicy(): string {
  const systemSetting = currentSettingSql("app.current_system_id");
  const accountSetting = currentSettingSql("app.current_account_id");
  return (
    `CREATE POLICY audit_log_tenant_isolation ON audit_log ` +
    `USING (account_id IS NOT NULL AND system_id IS NOT NULL AND account_id = ${accountSetting} AND system_id = ${systemSetting}) ` +
    `WITH CHECK (account_id IS NOT NULL AND system_id IS NOT NULL AND account_id = ${accountSetting} AND system_id = ${systemSetting})`
  );
}

/**
 * Creates the key_grants policies covering the two legitimate read paths.
 *
 * Write policies (INSERT/UPDATE/DELETE) remain tied to the originating
 * system via `system_id = current_system_id()`. The originating system is
 * the one that generated and encrypted the grant.
 *
 * Read policies:
 * 1. `key_grants_owner_read`: the originating system reads grants it issued.
 * 2. `key_grants_friend_read`: the recipient friend reads grants addressed
 *    to their account (`friend_account_id = current_account_id()`). The
 *    friend typically cannot set the originating system's ID as their
 *    session context, so the owner-read policy would otherwise block them.
 *
 * See audit finding db-eigy.
 */
export function keyGrantsRlsPolicy(): string[] {
  const systemSetting = currentSettingSql("app.current_system_id");
  const accountSetting = currentSettingSql("app.current_account_id");
  return [
    `CREATE POLICY key_grants_owner_read ON key_grants FOR SELECT USING (system_id = ${systemSetting})`,
    `CREATE POLICY key_grants_friend_read ON key_grants FOR SELECT USING (friend_account_id = ${accountSetting})`,
    `CREATE POLICY key_grants_write_insert ON key_grants FOR INSERT WITH CHECK (system_id = ${systemSetting})`,
    `CREATE POLICY key_grants_write_update ON key_grants FOR UPDATE USING (system_id = ${systemSetting}) WITH CHECK (system_id = ${systemSetting})`,
    `CREATE POLICY key_grants_write_delete ON key_grants FOR DELETE USING (system_id = ${systemSetting})`,
  ];
}

/** FK mapping type: fkColumn is the child column, fkTable is the parent, parentIdColumn is the parent PK, fkTenantColumn is the tenant column in parent. */
interface FkMapping {
  readonly fkColumn: string;
  readonly fkTable: string;
  readonly parentIdColumn: string;
  readonly fkTenantColumn: string;
}

/**
 * FK-to-tenant column mappings for account-fk scoped tables.
 */
const ACCOUNT_FK_MAPPING: Readonly<Record<string, FkMapping>> = {
  biometric_tokens: {
    fkColumn: "session_id",
    fkTable: "sessions",
    parentIdColumn: "id",
    fkTenantColumn: "account_id",
  },
};

/**
 * FK-to-tenant column mappings for system-fk scoped tables.
 */
const SYSTEM_FK_MAPPING: Readonly<Record<string, FkMapping>> = {
  sync_changes: {
    fkColumn: "document_id",
    fkTable: "sync_documents",
    parentIdColumn: "document_id",
    fkTenantColumn: "system_id",
  },
  sync_snapshots: {
    fkColumn: "document_id",
    fkTable: "sync_documents",
    parentIdColumn: "document_id",
    fkTenantColumn: "system_id",
  },
  sync_conflicts: {
    fkColumn: "document_id",
    fkTable: "sync_documents",
    parentIdColumn: "document_id",
    fkTenantColumn: "system_id",
  },
};

/**
 * Creates an RLS policy scoped via a foreign key to a tenant-holding parent table.
 * Uses a subquery to verify the FK references a row belonging to the current tenant.
 */
export function accountFkRlsPolicy(
  tableName: string,
  fkColumn: string,
  fkTable: string,
  parentIdColumn: string,
  fkTenantColumn: string,
): string {
  const policyName = `${tableName}_account_isolation`;
  const setting = currentSettingSql("app.current_account_id");
  return (
    `CREATE POLICY ${policyName} ON ${tableName} ` +
    `USING (${fkColumn} IN (SELECT ${parentIdColumn} FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting})) ` +
    `WITH CHECK (${fkColumn} IN (SELECT ${parentIdColumn} FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting}))`
  );
}

/**
 * Creates an RLS policy scoped via a foreign key to a system-tenant parent table.
 * Uses a subquery to verify the FK references a row belonging to the current system.
 */
export function systemFkRlsPolicy(
  tableName: string,
  fkColumn: string,
  fkTable: string,
  parentIdColumn: string,
  fkTenantColumn: string,
): string {
  const policyName = `${tableName}_system_isolation`;
  const setting = currentSettingSql("app.current_system_id");
  return (
    `CREATE POLICY ${policyName} ON ${tableName} ` +
    `USING (${fkColumn} IN (SELECT ${parentIdColumn} FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting})) ` +
    `WITH CHECK (${fkColumn} IN (SELECT ${parentIdColumn} FROM ${fkTable} WHERE ${fkTenantColumn} = ${setting}))`
  );
}

/**
 * Creates per-operation RLS policies for bidirectional account tables.
 * SELECT/DELETE: visible to both account_id and friend_account_id.
 * INSERT/UPDATE: restricted to account_id (sender) only.
 */
export function accountBidirectionalRlsPolicy(tableName: string): string[] {
  const setting = currentSettingSql("app.current_account_id");
  return [
    `CREATE POLICY ${tableName}_read ON ${tableName} FOR SELECT USING (account_id = ${setting} OR friend_account_id = ${setting})`,
    `CREATE POLICY ${tableName}_write ON ${tableName} FOR INSERT WITH CHECK (account_id = ${setting})`,
    `CREATE POLICY ${tableName}_update ON ${tableName} FOR UPDATE USING (account_id = ${setting}) WITH CHECK (account_id = ${setting})`,
    `CREATE POLICY ${tableName}_delete ON ${tableName} FOR DELETE USING (account_id = ${setting} OR friend_account_id = ${setting})`,
  ];
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
  systems: "systems-pk-with-account",
  nomenclature_settings: "system-pk",
  system_settings: "system-pk",
  innerworld_canvas: "system-pk",

  // Dual-column tables (account_id + system_id)
  api_keys: "dual",
  audit_log: "audit-log-null-aware",
  device_tokens: "dual",

  // System-scoped (denormalized system_id)
  key_grants: "key-grants",
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
  friend_connections: "account-bidirectional",
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

  // Sync — sync_changes, sync_snapshots, sync_conflicts lack system_id;
  // access control flows via FK to sync_documents which has system_id.
  sync_documents: "system",
  sync_changes: "system-fk",
  sync_snapshots: "system-fk",
  sync_conflicts: "system-fk",
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
        accountFkRlsPolicy(
          tableName,
          mapping.fkColumn,
          mapping.fkTable,
          mapping.parentIdColumn,
          mapping.fkTenantColumn,
        ),
      );
      break;
    }
    case "system-fk": {
      const mapping = SYSTEM_FK_MAPPING[tableName];
      if (!mapping) {
        throw new Error(`No FK mapping for system-fk table: ${tableName}`);
      }
      statements.push(
        systemFkRlsPolicy(
          tableName,
          mapping.fkColumn,
          mapping.fkTable,
          mapping.parentIdColumn,
          mapping.fkTenantColumn,
        ),
      );
      break;
    }
    case "account-bidirectional": {
      const policies = accountBidirectionalRlsPolicy(tableName);
      statements.push(...policies);
      break;
    }
    case "systems-pk-with-account": {
      statements.push(systemsPkRlsPolicy());
      break;
    }
    case "audit-log-null-aware": {
      statements.push(auditLogRlsPolicy());
      break;
    }
    case "key-grants": {
      statements.push(...keyGrantsRlsPolicy());
      break;
    }
    default: {
      const _exhaustive: never = scopeType;
      throw new Error(`Unknown RLS scope type: ${_exhaustive as string}`);
    }
  }

  return statements;
}
