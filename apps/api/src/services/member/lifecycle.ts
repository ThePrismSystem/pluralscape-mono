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
import { checkDependents } from "../../lib/check-dependents.js";
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

    const { dependents } = await checkDependents(tx, [
      {
        table: memberPhotos,
        predicate: and(eq(memberPhotos.memberId, memberId), eq(memberPhotos.systemId, systemId)),
        typeName: "photos",
      },
      {
        table: fieldValues,
        predicate: and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId)),
        typeName: "fieldValues",
      },
      {
        table: groupMemberships,
        predicate: and(
          eq(groupMemberships.memberId, memberId),
          eq(groupMemberships.systemId, systemId),
        ),
        typeName: "groupMemberships",
      },
      {
        table: frontingSessions,
        predicate: eq(frontingSessions.memberId, memberId),
        typeName: "frontingSessions",
      },
      {
        table: relationships,
        predicate: or(
          eq(relationships.sourceMemberId, memberId),
          eq(relationships.targetMemberId, memberId),
        ),
        typeName: "relationships",
      },
      {
        table: notes,
        predicate: and(eq(notes.authorEntityType, "member"), eq(notes.authorEntityId, memberId)),
        typeName: "notes",
      },
      {
        table: frontingComments,
        predicate: eq(frontingComments.memberId, memberId),
        typeName: "frontingComments",
      },
      {
        table: checkInRecords,
        predicate: eq(checkInRecords.respondedByMemberId, memberId),
        typeName: "checkInRecords",
      },
      {
        table: polls,
        predicate: eq(polls.createdByMemberId, memberId),
        typeName: "polls",
      },
      {
        table: acknowledgements,
        predicate: eq(acknowledgements.createdByMemberId, memberId),
        typeName: "acknowledgements",
      },
      {
        table: systemStructureEntityMemberLinks,
        predicate: and(
          eq(systemStructureEntityMemberLinks.memberId, memberId),
          eq(systemStructureEntityMemberLinks.systemId, systemId),
        ),
        typeName: "structureEntityMemberLinks",
      },
    ]);

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
