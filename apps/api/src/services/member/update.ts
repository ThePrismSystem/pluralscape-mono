import { members } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { UpdateMemberBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_MEMBER_DATA_BYTES } from "../../routes/members/members.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toMemberResult } from "./internal.js";

import type { MemberResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { MemberId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
