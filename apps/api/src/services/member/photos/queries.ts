import { memberPhotos } from "@pluralscape/db/pg";
import { and, eq, gt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { assertMemberActive } from "../../../lib/member-helpers.js";
import { buildCompositePaginatedResult } from "../../../lib/pagination.js";
import { withTenantRead } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toPhotoResult } from "./internal.js";

import type { MemberPhotoResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { DecodedCompositeCursor } from "../../../lib/pagination.js";
import type { MemberId, MemberPhotoId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Default page size for photo list. */
export const DEFAULT_PHOTO_LIMIT = 25;

/** Maximum page size for photo list. */
export const MAX_PHOTO_LIMIT = 50;

export interface MemberPhotoListOptions {
  readonly cursor?: DecodedCompositeCursor;
  readonly limit?: number;
}

export async function getMemberPhoto(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  photoId: MemberPhotoId,
  auth: AuthContext,
): Promise<MemberPhotoResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.id, photoId),
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Photo not found");
    }

    return toPhotoResult(row);
  });
}

export async function listMemberPhotos(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  opts: MemberPhotoListOptions = {},
): Promise<PaginatedResult<MemberPhotoResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PHOTO_LIMIT, MAX_PHOTO_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    await assertMemberActive(tx, systemId, memberId);

    const conditions = [
      eq(memberPhotos.memberId, memberId),
      eq(memberPhotos.systemId, systemId),
      eq(memberPhotos.archived, false),
    ];

    if (opts.cursor) {
      const cursorCondition = or(
        gt(memberPhotos.sortOrder, opts.cursor.sortValue),
        and(eq(memberPhotos.sortOrder, opts.cursor.sortValue), gt(memberPhotos.id, opts.cursor.id)),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    const rows = await tx
      .select()
      .from(memberPhotos)
      .where(and(...conditions))
      .orderBy(memberPhotos.sortOrder, memberPhotos.id)
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toPhotoResult,
      (item) => item.sortOrder,
    );
  });
}
