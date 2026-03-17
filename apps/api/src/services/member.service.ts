import { deserializeEncryptedBlob, InvalidInputError } from "@pluralscape/crypto";
import { fieldValues, members, memberPhotos } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/crypto-helpers.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_MEMBER_LIMIT,
  MAX_ENCRYPTED_MEMBER_DATA_BYTES,
  MAX_MEMBER_LIMIT,
} from "../routes/members/members.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  MemberId,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface MemberResult {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMemberResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): MemberResult {
  return {
    id: row.id as MemberId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
    archived: row.archived,
    archivedAt: row.archivedAt as UnixMillis | null,
  };
}

function parseAndValidateBlob(base64: string): EncryptedBlob {
  const rawBytes = Buffer.from(base64, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_MEMBER_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_MEMBER_DATA_BYTES)} bytes`,
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

export async function createMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  await assertSystemOwnership(db, systemId, auth);

  const parsed = CreateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid create payload");
  }

  const blob = parseAndValidateBlob(parsed.data.encryptedData);
  const memberId = createId(ID_PREFIXES.member);
  const timestamp = now();

  return db.transaction(async (tx) => {
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

    return toMemberResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listMembers(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts?: {
    cursor?: PaginationCursor;
    limit?: number;
    includeArchived?: boolean;
  },
): Promise<PaginatedResult<MemberResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const limit = Math.min(opts?.limit ?? DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT);
  const conditions = [eq(members.systemId, systemId)];

  if (!opts?.includeArchived) {
    conditions.push(eq(members.archived, false));
  }

  if (opts?.cursor) {
    conditions.push(gt(members.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(members)
    .where(and(...conditions))
    .orderBy(members.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toMemberResult);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
): Promise<MemberResult> {
  await assertSystemOwnership(db, systemId, auth);

  const [row] = await db
    .select()
    .from(members)
    .where(
      and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
  }

  return toMemberResult(row);
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  await assertSystemOwnership(db, systemId, auth);

  const parsed = UpdateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  const blob = parseAndValidateBlob(parsed.data.encryptedData);
  const timestamp = now();

  return db.transaction(async (tx) => {
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

    if (updated.length === 0) {
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

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
    }

    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await audit(tx, {
      eventType: "member.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Member updated",
      systemId,
    });

    return toMemberResult(row);
  });
}

// ── DUPLICATE ───────────────────────────────────────────────────────

export async function duplicateMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  await assertSystemOwnership(db, systemId, auth);

  const parsed = DuplicateMemberBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid duplicate payload");
  }

  const blob = parseAndValidateBlob(parsed.data.encryptedData);
  const newMemberId = createId(ID_PREFIXES.member);
  const timestamp = now();

  return db.transaction(async (tx) => {
    // Verify source member inside transaction to prevent TOCTOU
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

    // Copy photos if requested
    if (parsed.data.copyPhotos) {
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

      for (const photo of photos) {
        const [copied] = await tx
          .insert(memberPhotos)
          .values({
            id: createId(ID_PREFIXES.memberPhoto),
            memberId: newMemberId,
            systemId,
            sortOrder: photo.sortOrder,
            encryptedData: photo.encryptedData,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning({ id: memberPhotos.id });

        if (!copied) {
          throw new Error("Failed to copy member photo — INSERT returned no rows");
        }
      }
    }

    // Copy field values if requested
    if (parsed.data.copyFields) {
      const values = await tx
        .select()
        .from(fieldValues)
        .where(and(eq(fieldValues.memberId, memberId), eq(fieldValues.systemId, systemId)));

      for (const fv of values) {
        const [copied] = await tx
          .insert(fieldValues)
          .values({
            id: createId(ID_PREFIXES.fieldValue),
            fieldDefinitionId: fv.fieldDefinitionId,
            memberId: newMemberId,
            systemId,
            encryptedData: fv.encryptedData,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning({ id: fieldValues.id });

        if (!copied) {
          throw new Error("Failed to copy field value — INSERT returned no rows");
        }
      }
    }

    await audit(tx, {
      eventType: "member.duplicated",
      actor: { kind: "account", id: auth.accountId },
      detail: `Member duplicated from ${memberId}`,
      systemId,
    });

    return toMemberResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

export async function archiveMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
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

    // Cascade archive member photos
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
      detail: "Member archived",
      systemId,
    });

    await tx
      .update(members)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(members.id, memberId), eq(members.systemId, systemId)));
  });
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreMember(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MemberResult> {
  await assertSystemOwnership(db, systemId, auth);

  return db.transaction(async (tx) => {
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

    const timestamp = now();

    // Photos NOT auto-restored — user may have intentionally archived individual photos
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
