import {
  acknowledgements,
  checkInRecords,
  fieldValues,
  frontingComments,
  frontingSessions,
  groupMemberships,
  members,
  memberPhotos,
  notes,
  polls,
  relationships,
  systemStructureEntityMemberLinks,
  systems,
} from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  createId,
  now,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
} from "@pluralscape/validation";
import { and, count, eq, gt, inArray, or, sql } from "drizzle-orm";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_NOT_FOUND,
  HTTP_TOO_MANY_REQUESTS,
} from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_MEMBERS_PER_SYSTEM } from "../quota.constants.js";
import {
  DEFAULT_MEMBER_LIMIT,
  MAX_ENCRYPTED_MEMBER_DATA_BYTES,
  MAX_MEMBER_LIMIT,
} from "../routes/members/members.constants.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  GroupId,
  MemberId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface MemberResult {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMemberResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): MemberResult {
  return {
    id: brandId<MemberId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = CreateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
  const memberId = createId(ID_PREFIXES.member);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system member quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

    if ((existing?.count ?? 0) >= MAX_MEMBERS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_MEMBERS_PER_SYSTEM)} members per system`,
      );
    }

    const [row] = await tx
      .insert(members)
      .values({
        id: memberId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create member — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "member.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "member.created", {
      memberId: brandId<MemberId>(row.id),
    });

    return toMemberResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

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
      conditions.push(gt(members.id, opts.cursor));
    }

    // Filter to members belonging to a specific group via subquery
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

// ── GET ─────────────────────────────────────────────────────────────

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

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = UpdateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(members)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${members.version} + 1`,
      })
      .where(
        and(
          eq(members.id, memberId),
          eq(members.systemId, systemId),
          eq(members.version, parsed.data.version),
          eq(members.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.id, memberId),
              eq(members.systemId, systemId),
              eq(members.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Member",
    );

    await audit(tx, {
      eventType: "member.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "member.updated", {
      memberId: brandId<MemberId>(row.id),
    });

    return toMemberResult(row);
  });
}

// ── DUPLICATE ───────────────────────────────────────────────────────

export async function duplicateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = DuplicateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid duplicate payload");
  }

  const blob = validateEncryptedBlob(parsed.data.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
  const newMemberId = createId(ID_PREFIXES.member);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system member quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

    if ((existingCount?.count ?? 0) >= MAX_MEMBERS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_MEMBERS_PER_SYSTEM)} members per system`,
      );
    }

    // Verify source member inside transaction to prevent TOCTOU
    const [source] = await tx
      .select()
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!source) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    const [row] = await tx
      .insert(members)
      .values({
        id: newMemberId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to duplicate member — INSERT returned no rows");
    }

    // Copy photos if requested
    if (parsed.data.copyPhotos) {
      const photos = await tx
        .select()
        .from(memberPhotos)
        .where(
          and(
            eq(memberPhotos.memberId, memberId),
            eq(memberPhotos.systemId, systemId),
            eq(memberPhotos.archived, false),
          ),
        );

      if (photos.length > 0) {
        const photoRows = photos.map((photo) => ({
          id: createId(ID_PREFIXES.memberPhoto),
          memberId: newMemberId,
          systemId,
          sortOrder: photo.sortOrder,
          encryptedData: photo.encryptedData,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
        const inserted = await tx
          .insert(memberPhotos)
          .values(photoRows)
          .returning({ id: memberPhotos.id });
        if (inserted.length !== photos.length) {
          throw new Error("Failed to copy member photos — INSERT count mismatch");
        }
      }
    }

    // Copy field values if requested
    if (parsed.data.copyFields) {
      const values = await tx
        .select()
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId)));

      if (values.length > 0) {
        const fieldRows = values.map((fv) => ({
          id: createId(ID_PREFIXES.fieldValue),
          fieldDefinitionId: fv.fieldDefinitionId,
          memberId: newMemberId,
          systemId,
          encryptedData: fv.encryptedData,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
        const inserted = await tx
          .insert(fieldValues)
          .values(fieldRows)
          .returning({ id: fieldValues.id });
        if (inserted.length !== values.length) {
          throw new Error("Failed to copy field values — INSERT count mismatch");
        }
      }
    }

    // Copy group memberships if requested
    let membershipsCopied = 0;
    if (parsed.data.copyMemberships) {
      const memberships = await tx
        .select()
        .from(groupMemberships)
        .where(
          and(eq(groupMemberships.memberId, memberId), eq(groupMemberships.systemId, systemId)),
        );

      if (memberships.length > 0) {
        const membershipRows = memberships.map((m) => ({
          groupId: m.groupId,
          memberId: newMemberId,
          systemId,
          createdAt: timestamp,
        }));
        const inserted = await tx
          .insert(groupMemberships)
          .values(membershipRows)
          .returning({ groupId: groupMemberships.groupId });
        if (inserted.length !== memberships.length) {
          throw new Error("Failed to copy memberships — INSERT count mismatch");
        }
        membershipsCopied = memberships.length;
      }
    }

    await audit(tx, {
      eventType: "member.duplicated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Member duplicated from ${memberId}${membershipsCopied > 0 ? ` (${String(membershipsCopied)} membership(s) copied)` : ""}`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "member.created", {
      memberId: brandId<MemberId>(row.id),
    });

    return toMemberResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    const timestamp = now();

    // Cascade archive member photos
    await tx
      .update(memberPhotos)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      );

    await audit(tx, {
      eventType: "member.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member archived (photos cascade-archived, field values preserved)",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "member.archived", { memberId });

    await tx
      .update(members)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(members.id, memberId), eq(members.systemId, systemId)));
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select()
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, true)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    // Enforce per-system member quota on restore
    const [activeCount] = await tx
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

    if ((activeCount?.count ?? 0) >= MAX_MEMBERS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_MEMBERS_PER_SYSTEM)} members per system`,
      );
    }

    const timestamp = now();

    // Photos NOT auto-restored — user may have intentionally archived individual photos
    const [row] = await tx
      .update(members)
      .set({ archived: false, archivedAt: null, updatedAt: timestamp })
      .where(and(eq(members.id, memberId), eq(members.systemId, systemId)))
      .returning();

    if (!row) {
      throw new Error("Failed to restore member — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "member.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member restored",
      systemId,
    });

    return toMemberResult(row);
  });
}

// ── DELETE ──────────────────────────────────────────────────────────

export async function deleteMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    // Count all dependents across FK tables (parallel for performance)
    const [
      [photoCount],
      [fieldValueCount],
      [membershipCount],
      [frontingSessionCount],
      [relationshipCount],
      [noteCount],
      [frontingCommentCount],
      [checkInCount],
      [pollCount],
      [ackCount],
      [entityMemberLinkCount],
    ] = await Promise.all([
      tx
        .select({ count: count() })
        .from(memberPhotos)
        .where(and(eq(memberPhotos.memberId, memberId), eq(memberPhotos.systemId, systemId))),
      tx
        .select({ count: count() })
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId))),
      tx
        .select({ count: count() })
        .from(groupMemberships)
        .where(
          and(eq(groupMemberships.memberId, memberId), eq(groupMemberships.systemId, systemId)),
        ),
      tx
        .select({ count: count() })
        .from(frontingSessions)
        .where(eq(frontingSessions.memberId, memberId)),
      tx
        .select({ count: count() })
        .from(relationships)
        .where(
          or(
            eq(relationships.sourceMemberId, memberId),
            eq(relationships.targetMemberId, memberId),
          ),
        ),
      tx
        .select({ count: count() })
        .from(notes)
        .where(and(eq(notes.authorEntityType, "member"), eq(notes.authorEntityId, memberId))),
      tx
        .select({ count: count() })
        .from(frontingComments)
        .where(eq(frontingComments.memberId, memberId)),
      tx
        .select({ count: count() })
        .from(checkInRecords)
        .where(eq(checkInRecords.respondedByMemberId, memberId)),
      tx.select({ count: count() }).from(polls).where(eq(polls.createdByMemberId, memberId)),
      tx
        .select({ count: count() })
        .from(acknowledgements)
        .where(eq(acknowledgements.createdByMemberId, memberId)),
      tx
        .select({ count: count() })
        .from(systemStructureEntityMemberLinks)
        .where(
          and(
            eq(systemStructureEntityMemberLinks.memberId, memberId),
            eq(systemStructureEntityMemberLinks.systemId, systemId),
          ),
        ),
    ]);

    if (
      !photoCount ||
      !fieldValueCount ||
      !membershipCount ||
      !frontingSessionCount ||
      !relationshipCount ||
      !noteCount ||
      !frontingCommentCount ||
      !checkInCount ||
      !pollCount ||
      !ackCount ||
      !entityMemberLinkCount
    ) {
      throw new Error("Unexpected: count query returned no rows");
    }

    type MemberDependentType =
      | "photos"
      | "fieldValues"
      | "groupMemberships"
      | "frontingSessions"
      | "relationships"
      | "notes"
      | "frontingComments"
      | "checkInRecords"
      | "polls"
      | "acknowledgements"
      | "structureEntityMemberLinks";

    const dependents: { type: MemberDependentType; count: number }[] = [];
    if (photoCount.count > 0) dependents.push({ type: "photos", count: photoCount.count });
    if (fieldValueCount.count > 0)
      dependents.push({ type: "fieldValues", count: fieldValueCount.count });
    if (membershipCount.count > 0)
      dependents.push({ type: "groupMemberships", count: membershipCount.count });
    if (frontingSessionCount.count > 0)
      dependents.push({ type: "frontingSessions", count: frontingSessionCount.count });
    if (relationshipCount.count > 0)
      dependents.push({ type: "relationships", count: relationshipCount.count });
    if (noteCount.count > 0) dependents.push({ type: "notes", count: noteCount.count });
    if (frontingCommentCount.count > 0)
      dependents.push({ type: "frontingComments", count: frontingCommentCount.count });
    if (checkInCount.count > 0)
      dependents.push({ type: "checkInRecords", count: checkInCount.count });
    if (pollCount.count > 0) dependents.push({ type: "polls", count: pollCount.count });
    if (ackCount.count > 0) dependents.push({ type: "acknowledgements", count: ackCount.count });
    if (entityMemberLinkCount.count > 0)
      dependents.push({
        type: "structureEntityMemberLinks",
        count: entityMemberLinkCount.count,
      });

    if (dependents.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Member has dependents. Remove all dependents before deleting.",
        { dependents },
      );
    }

    await audit(tx, {
      eventType: "member.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member deleted",
      systemId,
    });

    await tx.delete(members).where(and(eq(members.id, memberId), eq(members.systemId, systemId)));
  });
}

// ── MEMBER MEMBERSHIPS ──────────────────────────────────────────────

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

    // Query all structure types in parallel
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
