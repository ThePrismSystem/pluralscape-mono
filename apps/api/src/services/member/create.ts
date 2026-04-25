import { fieldValues, groupMemberships, members, memberPhotos, systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateMemberBodySchema, DuplicateMemberBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_MEMBERS_PER_SYSTEM } from "../../quota.constants.js";
import { MAX_ENCRYPTED_MEMBER_DATA_BYTES } from "../../routes/members/members.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toMemberResult } from "./internal.js";

import type { MemberResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FieldValueId, MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateMemberBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
  const memberId = brandId<MemberId>(createId(ID_PREFIXES.member));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

export async function duplicateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  body: z.infer<typeof DuplicateMemberBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
  const newMemberId = brandId<MemberId>(createId(ID_PREFIXES.member));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

    if (body.copyPhotos) {
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
          id: brandId<MemberPhotoId>(createId(ID_PREFIXES.memberPhoto)),
          memberId: brandId<MemberId>(newMemberId),
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

    if (body.copyFields) {
      const values = await tx
        .select()
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId)));

      if (values.length > 0) {
        const fieldRows = values.map((fv) => ({
          id: brandId<FieldValueId>(createId(ID_PREFIXES.fieldValue)),
          fieldDefinitionId: fv.fieldDefinitionId,
          memberId: brandId<MemberId>(newMemberId),
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

    let membershipsCopied = 0;
    if (body.copyMemberships) {
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
