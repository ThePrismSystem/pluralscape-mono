import { groupMemberships, groups } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  CopyGroupBodySchema,
  MoveGroupBodySchema,
  ReorderGroupsBodySchema,
} from "@pluralscape/validation";
import { and, eq, inArray, max, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { detectAncestorCycle } from "../../lib/hierarchy.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toGroupResult } from "./internal.js";

import type { GroupResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── MOVE ────────────────────────────────────────────────────────────

export async function moveGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = MoveGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid move payload");
  }

  const { targetParentGroupId } = parsed.data;

  // Reject self-parenting
  if (targetParentGroupId === groupId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Cannot set group as its own parent",
    );
  }

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // If targetParentGroupId non-null, verify it exists and is not archived
    if (targetParentGroupId !== null) {
      const [target] = await tx
        .select({ id: groups.id, parentGroupId: groups.parentGroupId })
        .from(groups)
        .where(
          and(
            eq(groups.id, targetParentGroupId),
            eq(groups.systemId, systemId),
            eq(groups.archived, false),
          ),
        )
        .limit(1);

      if (!target) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target parent group not found");
      }

      // Cycle detection: walk ancestors from target up; if we find groupId, it's circular
      await detectAncestorCycle(
        async (id) => {
          const [row] = await tx
            .select({ parentGroupId: groups.parentGroupId })
            .from(groups)
            .where(and(eq(groups.id, brandId<GroupId>(id)), eq(groups.systemId, systemId)))
            .limit(1);
          return row?.parentGroupId;
        },
        targetParentGroupId,
        groupId,
        "Group",
      );
    }

    // OCC update
    const updated = await tx
      .update(groups)
      .set({
        parentGroupId: targetParentGroupId,
        updatedAt: timestamp,
        version: sql`${groups.version} + 1`,
      })
      .where(
        and(
          eq(groups.id, groupId),
          eq(groups.systemId, systemId),
          eq(groups.version, parsed.data.version),
          eq(groups.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: groups.id })
          .from(groups)
          .where(
            and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Group",
    );

    await audit(tx, {
      eventType: "group.moved",
      actor: { kind: "account", id: auth.accountId },
      detail: `Group moved to parent ${targetParentGroupId ?? "root"}`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "group.updated", { groupId });

    return toGroupResult(row);
  });
}

// ── COPY ────────────────────────────────────────────────────────────

export async function copyGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<GroupResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CopyGroupBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid copy payload");
  }

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Fetch source group
    const [source] = await tx
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
      .limit(1);

    if (!source) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source group not found");
    }

    // Determine target parent — use provided value or default to same parent as source
    const targetParentGroupId =
      parsed.data.targetParentGroupId !== undefined
        ? parsed.data.targetParentGroupId
        : source.parentGroupId;

    // Validate target parent if non-null
    if (targetParentGroupId !== null) {
      const [target] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(
            eq(groups.id, targetParentGroupId),
            eq(groups.systemId, systemId),
            eq(groups.archived, false),
          ),
        )
        .limit(1);

      if (!target) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Target parent group not found");
      }
    }

    // Compute sort order: max among siblings + 1
    const parentCondition =
      targetParentGroupId === null
        ? sql`${groups.parentGroupId} IS NULL`
        : eq(groups.parentGroupId, targetParentGroupId);

    const [maxResult] = await tx
      .select({ maxSort: max(groups.sortOrder) })
      .from(groups)
      .where(and(eq(groups.systemId, systemId), parentCondition, eq(groups.archived, false)));

    const sortOrder = (maxResult?.maxSort ?? -1) + 1;

    // Insert new group
    const newGroupId = brandId<GroupId>(createId(ID_PREFIXES.group));
    const [row] = await tx
      .insert(groups)
      .values({
        id: newGroupId,
        systemId,
        parentGroupId: targetParentGroupId,
        sortOrder,
        encryptedData: source.encryptedData,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to copy group — INSERT returned no rows");
    }

    // Optionally copy memberships
    if (parsed.data.copyMemberships) {
      const memberships = await tx
        .select({
          memberId: groupMemberships.memberId,
        })
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.systemId, systemId)));

      if (memberships.length > 0) {
        await tx.insert(groupMemberships).values(
          memberships.map((m) => ({
            groupId: newGroupId,
            memberId: m.memberId,
            systemId,
            createdAt: timestamp,
          })),
        );
      }
    }

    await audit(tx, {
      eventType: "group.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Group copied from ${groupId}`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "group.created", {
      groupId: brandId<GroupId>(newGroupId),
    });

    return toGroupResult(row);
  });
}

// ── REORDER ─────────────────────────────────────────────────────────

export async function reorderGroups(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const parsed = ReorderGroupsBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid reorder payload");
  }

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Pre-flight: verify all target groups exist and are active
    const groupIds = parsed.data.operations.map((op) => op.groupId);
    const existing = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.systemId, systemId), eq(groups.archived, false)));
    const existingIds = new Set(existing.map((g) => g.id));
    for (const gid of groupIds) {
      if (!existingIds.has(gid)) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `Group ${gid} not found`);
      }
    }

    const targetIds = parsed.data.operations.map((op) => op.groupId);
    const cases = parsed.data.operations.map(
      (op) => sql`WHEN ${groups.id} = ${op.groupId} THEN ${op.sortOrder}`,
    );
    const updatedRows = await tx
      .update(groups)
      .set({
        sortOrder: sql<number>`CASE ${sql.join(cases, sql` `)} ELSE ${groups.sortOrder} END::integer`,
      })
      .where(
        and(
          inArray(groups.id, targetIds),
          eq(groups.systemId, systemId),
          eq(groups.archived, false),
        ),
      )
      .returning({ id: groups.id });

    if (updatedRows.length !== parsed.data.operations.length) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Expected ${String(parsed.data.operations.length)} groups, updated ${String(updatedRows.length)}`,
      );
    }

    await audit(tx, {
      eventType: "group.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(parsed.data.operations.length)} group(s)`,
      systemId,
    });
  });
}
