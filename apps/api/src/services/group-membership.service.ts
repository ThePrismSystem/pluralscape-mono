import { groupMemberships, groups, members } from "@pluralscape/db/pg";
import { now, toUnixMillis } from "@pluralscape/types";
import { AddGroupMemberBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { toCursor } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { throwOnUniqueViolation } from "../lib/unique-violation.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { GroupId, MemberId, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface GroupMembershipResult {
  readonly groupId: GroupId;
  readonly memberId: MemberId;
  readonly systemId: SystemId;
  readonly createdAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMembershipResult(row: {
  groupId: string;
  memberId: string;
  systemId: string;
  createdAt: number;
}): GroupMembershipResult {
  return {
    groupId: row.groupId as GroupId,
    memberId: row.memberId as MemberId,
    systemId: row.systemId as SystemId,
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── ADD MEMBER ──────────────────────────────────────────────────────

export async function addMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupMembershipResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = AddGroupMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid add member payload");
  }

  const { memberId } = parsed.data;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify group exists and is not archived
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!group) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
    }

    // Verify member exists and is not archived
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!member) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    // Insert membership — handle PK violation
    try {
      const [row] = await tx
        .insert(groupMemberships)
        .values({
          groupId,
          memberId: memberId as MemberId,
          systemId,
          createdAt: timestamp,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to add member — INSERT returned no rows");
      }

      await audit(tx, {
        eventType: "group-membership.added",
        actor: { kind: "account", id: auth.accountId },
        detail: `Member ${memberId} added to group ${groupId}`,
        systemId,
      });

      return toMembershipResult(row);
    } catch (error: unknown) {
      throwOnUniqueViolation(error, "Already a member of this group");
    }
  });
}

// ── REMOVE MEMBER ───────────────────────────────────────────────────

export async function removeMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.memberId, memberId),
          eq(groupMemberships.systemId, systemId),
        ),
      )
      .returning({ groupId: groupMemberships.groupId });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group membership not found");
    }

    await audit(tx, {
      eventType: "group-membership.removed",
      actor: { kind: "account", id: auth.accountId },
      detail: `Member ${memberId} removed from group ${groupId}`,
      systemId,
    });
  });
}

// ── LIST MEMBERS ────────────────────────────────────────────────────

export async function listGroupMembers(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<GroupMembershipResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify group exists
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!group) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
    }

    const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

    const conditions = [
      eq(groupMemberships.groupId, groupId),
      eq(groupMemberships.systemId, systemId),
    ];

    if (cursor) {
      conditions.push(gt(groupMemberships.memberId, cursor));
    }

    const rows = await tx
      .select({
        groupId: groupMemberships.groupId,
        memberId: groupMemberships.memberId,
        systemId: groupMemberships.systemId,
        createdAt: groupMemberships.createdAt,
      })
      .from(groupMemberships)
      .where(and(...conditions))
      .orderBy(groupMemberships.memberId)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toMembershipResult);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? toCursor(lastItem.memberId) : null;

    return {
      data: items,
      nextCursor,
      hasMore,
      totalCount: null,
    };
  });
}

// ── LIST MEMBER'S GROUP MEMBERSHIPS ─────────────────────────────────

export async function listMemberGroupMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<GroupMembershipResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify member exists
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!member) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

    const conditions = [
      eq(groupMemberships.memberId, memberId),
      eq(groupMemberships.systemId, systemId),
    ];

    if (cursor) {
      conditions.push(gt(groupMemberships.groupId, cursor));
    }

    const rows = await tx
      .select({
        groupId: groupMemberships.groupId,
        memberId: groupMemberships.memberId,
        systemId: groupMemberships.systemId,
        createdAt: groupMemberships.createdAt,
      })
      .from(groupMemberships)
      .where(and(...conditions))
      .orderBy(groupMemberships.groupId)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toMembershipResult);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? toCursor(lastItem.groupId) : null;

    return {
      data: items,
      nextCursor,
      hasMore,
      totalCount: null,
    };
  });
}
