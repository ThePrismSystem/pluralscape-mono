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
} from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, count, eq, or } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_MEMBERS_PER_SYSTEM } from "../../quota.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toMemberResult } from "./internal.js";

import type { MemberResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { MemberId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
