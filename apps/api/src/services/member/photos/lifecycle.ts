import { memberPhotos } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_PHOTOS_PER_MEMBER, MAX_PHOTOS_PER_SYSTEM } from "../../../quota.constants.js";

import { toPhotoResult } from "./internal.js";

import type { MemberPhotoResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── ARCHIVE (soft delete) ───────────────────────────────────────────

export async function archiveMemberPhoto(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  photoId: MemberPhotoId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: memberPhotos.id })
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Photo not found");
    }

    const timestamp = now();

    await audit(tx, {
      eventType: "member-photo.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member photo archived",
      systemId,
    });

    await tx
      .update(memberPhotos)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(memberPhotos.id, photoId),
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
        ),
      );
  });
}

// ── RESTORE ────────────────────────────────────────────────────────

export async function restoreMemberPhoto(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  photoId: MemberPhotoId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberPhotoResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select()
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.id, photoId),
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, true),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Photo not found");
    }

    // Enforce per-member photo quota on restore
    const [memberCount] = await tx
      .select({ count: count() })
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      );

    if ((memberCount?.count ?? 0) >= MAX_PHOTOS_PER_MEMBER) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_PHOTOS_PER_MEMBER)} photos per member`,
      );
    }

    // Enforce system-wide photo quota on restore
    const [systemCount] = await tx
      .select({ count: count() })
      .from(memberPhotos)
      .where(and(eq(memberPhotos.systemId, systemId), eq(memberPhotos.archived, false)));

    if ((systemCount?.count ?? 0) >= MAX_PHOTOS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_PHOTOS_PER_SYSTEM)} photos per system`,
      );
    }

    const timestamp = now();

    const [row] = await tx
      .update(memberPhotos)
      .set({ archived: false, archivedAt: null, updatedAt: timestamp })
      .where(
        and(
          eq(memberPhotos.id, photoId),
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error("Failed to restore member photo — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "member-photo.restored",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member photo restored",
      systemId,
    });

    return toPhotoResult(row);
  });
}

// ── DELETE (hard delete) ────────────────────────────────────────────

export async function deleteMemberPhoto(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  photoId: MemberPhotoId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: memberPhotos.id })
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Photo not found");
    }

    await audit(tx, {
      eventType: "member-photo.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member photo deleted",
      systemId,
    });

    await tx.delete(memberPhotos).where(eq(memberPhotos.id, photoId));
  });
}
