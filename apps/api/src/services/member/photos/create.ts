import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { memberPhotos, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { CreateMemberPhotoBodySchema } from "@pluralscape/validation";
import { and, count, eq, max } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { assertMemberActive } from "../../../lib/member-helpers.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_PHOTOS_PER_MEMBER, MAX_PHOTOS_PER_SYSTEM } from "../../../quota.constants.js";

import { toPhotoResult } from "./internal.js";

import type { MemberPhotoResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { EncryptedBlob, MemberId, MemberPhotoId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const MAX_ENCRYPTED_PHOTO_DATA_BYTES = 131_072;

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
  const photoId = brandId<MemberPhotoId>(createId(ID_PREFIXES.memberPhoto));
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
