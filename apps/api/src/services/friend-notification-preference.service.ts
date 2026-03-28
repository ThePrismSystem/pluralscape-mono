import { friendNotificationPreferences } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { assertAccountOwnership } from "../lib/account-ownership.js";
import { ApiHttpError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";
import { isFkViolation } from "../lib/pg-error.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  AuditEventType,
  FriendConnectionId,
  FriendNotificationEventType,
  FriendNotificationPreferenceId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ────────────────────────────────────────────────────────

/** Audit event: friend notification preference was updated. */
const AUDIT_PREFERENCE_UPDATED: AuditEventType = "friend-notification-preference.updated";

/** Default enabled event types for new preferences. */
const DEFAULT_ENABLED_EVENT_TYPES: readonly FriendNotificationEventType[] = ["friend-switch-alert"];

// ── Types ────────────────────────────────────────────────────────────

export interface FriendNotificationPreferenceResult {
  readonly id: FriendNotificationPreferenceId;
  readonly accountId: AccountId;
  readonly friendConnectionId: FriendConnectionId;
  readonly enabledEventTypes: readonly FriendNotificationEventType[];
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ──────────────────────────────────────────────────────────

function toPreferenceResult(row: {
  id: string;
  accountId: string;
  friendConnectionId: string;
  enabledEventTypes: readonly FriendNotificationEventType[];
  createdAt: number;
  updatedAt: number;
}): FriendNotificationPreferenceResult {
  return {
    id: row.id as FriendNotificationPreferenceId,
    accountId: row.accountId as AccountId,
    friendConnectionId: row.friendConnectionId as FriendConnectionId,
    enabledEventTypes: row.enabledEventTypes,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── Service functions ────────────────────────────────────────────────

/**
 * Get the notification preference for a friend connection, creating it with
 * defaults (all friend event types enabled) if it doesn't exist yet.
 */
export async function getOrCreateFriendNotificationPreference(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendNotificationPreferenceResult> {
  assertAccountOwnership(accountId, auth);

  return withAccountTransaction(db, accountId, async (tx) => {
    // Try existing first
    const [existing] = await tx
      .select()
      .from(friendNotificationPreferences)
      .where(
        and(
          eq(friendNotificationPreferences.accountId, accountId),
          eq(friendNotificationPreferences.friendConnectionId, connectionId),
          eq(friendNotificationPreferences.archived, false),
        ),
      )
      .limit(1);

    if (existing) {
      return toPreferenceResult(existing);
    }

    // Create with defaults
    const timestamp = now();
    const id = createId(ID_PREFIXES.friendNotificationPreference) as FriendNotificationPreferenceId;

    try {
      const [created] = await tx
        .insert(friendNotificationPreferences)
        .values({
          id,
          accountId,
          friendConnectionId: connectionId,
          enabledEventTypes: DEFAULT_ENABLED_EVENT_TYPES,
          createdAt: timestamp,
          updatedAt: timestamp,
          archived: false,
          archivedAt: null,
        })
        .returning();

      if (!created) {
        throw new Error("Friend notification preference insert returned no rows");
      }

      return toPreferenceResult(created);
    } catch (err: unknown) {
      if (isFkViolation(err)) {
        logger.warn("[friend-notification-preference] FK constraint on insert", {
          accountId,
          connectionId,
        });
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
      }
      throw err;
    }
  });
}

/**
 * Update the enabled event types for a friend notification preference.
 * Returns 404 if no preference exists (caller should use getOrCreate first).
 */
export async function updateFriendNotificationPreference(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  params: { readonly enabledEventTypes: readonly FriendNotificationEventType[] },
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendNotificationPreferenceResult> {
  assertAccountOwnership(accountId, auth);

  return withAccountTransaction(db, accountId, async (tx) => {
    const timestamp = now();

    const [updated] = await tx
      .update(friendNotificationPreferences)
      .set({
        enabledEventTypes: params.enabledEventTypes,
        updatedAt: timestamp,
      })
      .where(
        and(
          eq(friendNotificationPreferences.accountId, accountId),
          eq(friendNotificationPreferences.friendConnectionId, connectionId),
          eq(friendNotificationPreferences.archived, false),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        "Friend notification preference not found",
      );
    }

    await audit(tx, {
      eventType: AUDIT_PREFERENCE_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend notification preference updated",
      accountId,
      systemId: null,
    });

    return toPreferenceResult(updated);
  });
}

/** List all non-archived friend notification preferences for an account. */
export async function listFriendNotificationPreferences(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
): Promise<readonly FriendNotificationPreferenceResult[]> {
  assertAccountOwnership(accountId, auth);

  return withAccountRead(db, accountId, async (tx) => {
    const rows = await tx
      .select()
      .from(friendNotificationPreferences)
      .where(
        and(
          eq(friendNotificationPreferences.accountId, accountId),
          eq(friendNotificationPreferences.archived, false),
        ),
      )
      .limit(MAX_PAGE_LIMIT);

    return rows.map(toPreferenceResult);
  });
}
