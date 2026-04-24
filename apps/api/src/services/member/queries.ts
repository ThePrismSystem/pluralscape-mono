import { groupMemberships, members, systemStructureEntityMemberLinks } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, eq, gt, inArray } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT } from "../../routes/members/members.constants.js";

import { toMemberResult } from "./internal.js";

import type { MemberResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, MemberId, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listMembers(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: string;
    limit?: number;
    includeArchived?: boolean;
    groupId?: GroupId;
  },
): Promise<PaginatedResult<MemberResult>> {
  assertSystemOwnership(systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(members.systemId, systemId)];

    if (!opts?.includeArchived) {
      conditions.push(eq(members.archived, false));
    }

    if (opts?.cursor) {
      conditions.push(gt(members.id, brandId<MemberId>(opts.cursor)));
    }

    if (opts?.groupId) {
      const memberIdsInGroup = tx
        .select({ memberId: groupMemberships.memberId })
        .from(groupMemberships)
        .where(
          and(eq(groupMemberships.groupId, opts.groupId), eq(groupMemberships.systemId, systemId)),
        );
      conditions.push(inArray(members.id, memberIdsInGroup));
    }

    const rows = await tx
      .select()
      .from(members)
      .where(and(...conditions))
      .orderBy(members.id)
      .limit(limit + 1);

    return buildPaginatedResult(rows, limit, toMemberResult);
  });
}

export async function getMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    return toMemberResult(row);
  });
}

/** Result of listing a member's memberships across all structure types. */
export interface MemberMembershipsResult {
  readonly groups: ReadonlyArray<{
    readonly groupId: GroupId;
    readonly memberId: MemberId;
    readonly systemId: SystemId;
    readonly createdAt: UnixMillis;
  }>;
  readonly structureEntities: ReadonlyArray<{
    readonly id: string;
    readonly parentEntityId: string | null;
    readonly memberId: MemberId;
    readonly systemId: SystemId;
    readonly createdAt: UnixMillis;
  }>;
}

export async function listAllMemberMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
): Promise<MemberMembershipsResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
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

    const [groupRows, entityMemberRows] = await Promise.all([
      tx
        .select()
        .from(groupMemberships)
        .where(
          and(eq(groupMemberships.memberId, memberId), eq(groupMemberships.systemId, systemId)),
        ),
      tx
        .select()
        .from(systemStructureEntityMemberLinks)
        .where(
          and(
            eq(systemStructureEntityMemberLinks.memberId, memberId),
            eq(systemStructureEntityMemberLinks.systemId, systemId),
          ),
        ),
    ]);

    return {
      groups: groupRows.map((r) => ({
        groupId: brandId<GroupId>(r.groupId),
        memberId: brandId<MemberId>(r.memberId),
        systemId: brandId<SystemId>(r.systemId),
        createdAt: toUnixMillis(r.createdAt),
      })),
      structureEntities: entityMemberRows.map((r) => ({
        id: r.id,
        parentEntityId: r.parentEntityId,
        memberId: brandId<MemberId>(r.memberId),
        systemId: brandId<SystemId>(r.systemId),
        createdAt: toUnixMillis(r.createdAt),
      })),
    };
  });
}
