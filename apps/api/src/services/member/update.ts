import { members } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { UpdateMemberBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

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
import type { z } from "zod/v4";

export async function updateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  body: z.infer<typeof UpdateMemberBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_MEMBER_DATA_BYTES);
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
          eq(members.version, body.version),
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
