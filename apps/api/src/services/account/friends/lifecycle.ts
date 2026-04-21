import { friendConnections } from "@pluralscape/db/pg";

import { archiveAccountEntity, restoreAccountEntity } from "../../../lib/entity-lifecycle.js";

import { toFriendConnectionResult } from "./internal.js";

import type { FriendConnectionResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountArchivableEntityConfig } from "../../../lib/entity-lifecycle.js";
import type { AccountId, AuditEventType, FriendConnectionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const AUDIT_FRIEND_ARCHIVED: AuditEventType = "friend-connection.archived";
const AUDIT_FRIEND_RESTORED: AuditEventType = "friend-connection.restored";

// ── Entity lifecycle config (account-scoped) ──────────────────────

const FRIEND_CONNECTION_LIFECYCLE: AccountArchivableEntityConfig<FriendConnectionId> = {
  table: friendConnections,
  columns: {
    id: friendConnections.id,
    accountId: friendConnections.accountId,
    archived: friendConnections.archived,
    archivedAt: friendConnections.archivedAt,
    updatedAt: friendConnections.updatedAt,
    version: friendConnections.version,
  },
  entityName: "Friend connection",
  archiveEvent: AUDIT_FRIEND_ARCHIVED,
  restoreEvent: AUDIT_FRIEND_RESTORED,
};

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveAccountEntity(db, accountId, connectionId, auth, audit, FRIEND_CONNECTION_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  return restoreAccountEntity(
    db,
    accountId,
    connectionId,
    auth,
    audit,
    FRIEND_CONNECTION_LIFECYCLE,
    (row) => toFriendConnectionResult(row as typeof friendConnections.$inferSelect),
  );
}
