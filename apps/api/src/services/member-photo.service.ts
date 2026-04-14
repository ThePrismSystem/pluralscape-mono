import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { memberPhotos, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { CreateMemberPhotoBodySchema, ReorderPhotosBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, inArray, max, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertMemberActive } from "../lib/member-helpers.js";
import { buildCompositePaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { MAX_PHOTOS_PER_MEMBER, MAX_PHOTOS_PER_SYSTEM } from "../quota.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { DecodedCompositeCursor } from "../lib/pagination.js";
import type {
  EncryptedBlob,
  MemberId,
  MemberPhotoId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ───────────────────────────────────────────────────────

const MAX_ENCRYPTED_PHOTO_DATA_BYTES = 131_072;

/** Default page size for photo list. */
export const DEFAULT_PHOTO_LIMIT = 25;

/** Maximum page size for photo list. */
export const MAX_PHOTO_LIMIT = 50;

// ── Types ───────────────────────────────────────────────────────────

export interface MemberPhotoListOptions {
  readonly cursor?: DecodedCompositeCursor;
  readonly limit?: number;
}

export interface MemberPhotoResult {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toPhotoResult(row: {
  id: string;
  memberId: string;
  systemId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): MemberPhotoResult {
  return {
    id: row.id as MemberPhotoId,
    memberId: row.memberId as MemberId,
    systemId: row.systemId as SystemId,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

function parseAndValidatePhotoBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_PHOTO_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_PHOTO_DATA_BYTES)} bytes`,
    );
  }

  try {
    return deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error: unknown) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createMemberPhoto(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberPhotoResult> {
  assertSystemOwnership(systemId, auth);
  await assertMemberActive(db, systemId, memberId);

  const parsed = CreateMemberPhotoBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = parseAndValidatePhotoBlob(parsed.data.encryptedData);
  const photoId = createId(ID_PREFIXES.memberPhoto);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock system row to serialize concurrent quota checks
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    // Check quota inside transaction to prevent TOCTOU races
    const [countResult] = await tx
      .select({ count: count() })
      .from(memberPhotos)
      .where(
        and(
          eq(memberPhotos.memberId, memberId),
          eq(memberPhotos.systemId, systemId),
          eq(memberPhotos.archived, false),
        ),
      );

    if ((countResult?.count ?? 0) >= MAX_PHOTOS_PER_MEMBER) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_PHOTOS_PER_MEMBER)} photos per member`,
      );
    }

    // System-wide photo quota
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

    // Determine sort order
    let sortOrder = parsed.data.sortOrder;
    if (sortOrder === undefined) {
      const [maxResult] = await tx
        .select({ maxSort: max(memberPhotos.sortOrder) })
        .from(memberPhotos)
        .where(
          and(
            eq(memberPhotos.memberId, memberId),
            eq(memberPhotos.systemId, systemId),
            eq(memberPhotos.archived, false),
          ),
        );
      sortOrder = (maxResult?.maxSort ?? -1) + 1;
    }

    const [row] = await tx
      .insert(memberPhotos)
      .values({
        id: photoId,
        memberId,
        systemId,
        sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create member photo — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "member-photo.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member photo created",
      systemId,
    });

    return toPhotoResult(row);
  });
}

// ── GET ────────────────────────────────────────────────────────────

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

// ── LIST ────────────────────────────────────────────────────────────

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

// ── REORDER ─────────────────────────────────────────────────────────

export async function reorderMemberPhotos(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberPhotoResult[]> {
  assertSystemOwnership(systemId, auth);
  await assertMemberActive(db, systemId, memberId);

  const parsed = ReorderPhotosBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid reorder payload");
  }

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

    const existingIds = new Set(existingPhotos.map((p) => p.id));

    for (const item of parsed.data.order) {
      if (!existingIds.has(item.id)) {
        throw new ApiHttpError(
          HTTP_BAD_REQUEST,
          "VALIDATION_ERROR",
          `Photo ${item.id} does not belong to this member`,
        );
      }
    }

    // Reorder must include all active photos
    if (parsed.data.order.length !== existingPhotos.length) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Reorder must include all ${String(existingPhotos.length)} active photos, got ${String(parsed.data.order.length)}`,
      );
    }

    // Batch update sort orders with single CASE/WHEN query
    const targetIds = parsed.data.order.map((item) => item.id);
    const cases = parsed.data.order.map(
      (item) => sql`WHEN ${memberPhotos.id} = ${item.id} THEN ${item.sortOrder}`,
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

    if (updatedRows.length !== parsed.data.order.length) {
      throw new ApiHttpError(
        HTTP_NOT_FOUND,
        "NOT_FOUND",
        `Failed to update sort order for ${String(parsed.data.order.length - updatedRows.length)} photos`,
      );
    }

    await audit(tx, {
      eventType: "member-photo.reordered",
      actor: { kind: "account", id: auth.accountId },
      detail: `Reordered ${String(parsed.data.order.length)} photos`,
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
