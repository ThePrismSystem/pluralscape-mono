import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { memberPhotos } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateMemberPhotoBodySchema, ReorderPhotosBodySchema } from "@pluralscape/validation";
import { and, count, eq, max } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertMemberActive } from "../lib/member-helpers.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  MemberId,
  MemberPhotoId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Constants ───────────────────────────────────────────────────────

const MAX_PHOTOS_PER_MEMBER = 50;
const MAX_ENCRYPTED_PHOTO_DATA_BYTES = 131_072;

// ── Types ───────────────────────────────────────────────────────────

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
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
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
  } catch (error) {
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

  return db.transaction(async (tx) => {
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

// ── LIST ────────────────────────────────────────────────────────────

export async function listMemberPhotos(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
): Promise<MemberPhotoResult[]> {
  assertSystemOwnership(systemId, auth);
  await assertMemberActive(db, systemId, memberId);

  const rows = await db
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

  return db.transaction(async (tx) => {
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

    // Batch update sort orders
    const updateResults = await Promise.all(
      parsed.data.order.map((item) =>
        tx
          .update(memberPhotos)
          .set({ sortOrder: item.sortOrder, updatedAt: timestamp })
          .where(
            and(
              eq(memberPhotos.id, item.id),
              eq(memberPhotos.memberId, memberId),
              eq(memberPhotos.systemId, systemId),
            ),
          )
          .returning({ id: memberPhotos.id }),
      ),
    );

    const orderItems = parsed.data.order;
    for (let i = 0; i < updateResults.length; i++) {
      const result = updateResults[i];
      const item = orderItems[i];
      if ((!result || result.length === 0) && item) {
        throw new ApiHttpError(
          HTTP_NOT_FOUND,
          "NOT_FOUND",
          `Failed to update sort order for photo ${item.id}`,
        );
      }
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

  await db.transaction(async (tx) => {
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

  return db.transaction(async (tx) => {
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

  await db.transaction(async (tx) => {
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
