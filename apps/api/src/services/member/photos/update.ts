import { memberPhotos } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { and, eq, inArray, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { assertMemberActive } from "../../../lib/member-helpers.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toPhotoResult } from "./internal.js";

import type { MemberPhotoResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { ReorderPhotosBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function reorderMemberPhotos(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  body: z.infer<typeof ReorderPhotosBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberPhotoResult[]> {
  assertSystemOwnership(systemId, auth);
  await assertMemberActive(db, systemId, memberId);

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify all photo IDs belong to this member
    const existingPhotos = await tx
      .select({ id: memberPhotos.id })
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      );

    const existingIds = new Set<string>(existingPhotos.map((p) => p.id));

    for (const item of body.order) {
      if (!existingIds.has(item.id)) {
        throw new ApiHttpError(
          HTTP_BAD_REQUEST,
          "VALIDATION_ERROR",
          `Photo ${item.id} does not belong to this member`,
        );
      }
    }

    // Reorder must include all active photos
    if (body.order.length !== existingPhotos.length) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Reorder must include all ${String(existingPhotos.length)} active photos, got ${String(body.order.length)}`,
      );
    }

    // Batch update sort orders with single CASE/WHEN query
    const targetIds = body.order.map((item) => brandId<MemberPhotoId>(item.id));
    const cases = body.order.map(
      (item) =>
        sql`WHEN ${memberPhotos.id} = ${brandId<MemberPhotoId>(item.id)} THEN ${item.sortOrder}`,
    );
    const updatedRows = await tx
      .update(memberPhotos)
      .set({
        sortOrder: sql<number>`CASE ${sql.join(cases, sql` `)} ELSE ${memberPhotos.sortOrder} END::integer`,
        updatedAt: timestamp,
      })
      .where(
        and(
          inArray(memberPhotos.id, targetIds),
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
        ),
      )
      .returning({ id: memberPhotos.id });

    if (updatedRows.length !== body.order.length) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Failed to update sort order for ${String(body.order.length - updatedRows.length)} photos`,
      );
    }

    await audit(tx, {
      eventType: "member-photo.reordered",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(body.order.length)} photos`,
      systemId,
    });

    // Return updated list
    const rows = await tx
      .select()
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      )
      .orderBy(memberPhotos.sortOrder);

    return rows.map(toPhotoResult);
  });
}
