import { InvalidInputError, deserializeEncryptedBlob } from "@pluralscape/crypto";
import {
  layers,
  sideSystemLayerLinks,
  sideSystems,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import {
  CreateSideSystemLayerLinkBodySchema,
  CreateSubsystemLayerLinkBodySchema,
  CreateSubsystemSideSystemLinkBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";


import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/assert-system-ownership.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

// ── Types ───────────────────────────────────────────────────────────

export interface StructureLinkResult {
  readonly id: string;
  readonly entityAId: string;
  readonly entityBId: string;
  readonly systemId: SystemId;
  readonly encryptedData: string | null;
  readonly createdAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseLinkBody<T>(
  params: unknown,
  schema: z.ZodType<T>,
): { parsed: T; blob: EncryptedBlob | null } {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }

  const data = result.data as T & { encryptedData?: string };
  if (!data.encryptedData) {
    return { parsed: result.data, blob: null };
  }

  const rawBytes = Buffer.from(data.encryptedData, "base64");
  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  try {
    const blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
    return { parsed: result.data, blob };
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}

async function verifyNotArchived(
  tx: Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0],
  table: typeof subsystems | typeof sideSystems | typeof layers,
  id: string,
  systemId: SystemId,
  entityName: string,
): Promise<void> {
  const [entity] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.systemId, systemId), eq(table.archived, false)))
    .limit(1);

  if (!entity) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
  }
}

// ── SUBSYSTEM ↔ LAYER ──────────────────────────────────────────────

export async function createSubsystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  assertSystemOwnership(auth, systemId);

  const { parsed, blob } = parseLinkBody(params, CreateSubsystemLayerLinkBodySchema);

  const linkId = createId(ID_PREFIXES.structureLink);
  const timestamp = now();

  return db.transaction(async (tx) => {
    await verifyNotArchived(tx, subsystems, parsed.subsystemId, systemId, "Subsystem");
    await verifyNotArchived(tx, layers, parsed.layerId, systemId, "Layer");

    try {
      const [row] = await tx
        .insert(subsystemLayerLinks)
        .values({
          id: linkId,
          subsystemId: parsed.subsystemId,
          layerId: parsed.layerId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: "structure-link.created",
        actor: { kind: "account", id: auth.accountId },
        detail: `Subsystem ${parsed.subsystemId} linked to layer ${parsed.layerId}`,
        systemId,
      });

      return {
        id: row.id,
        entityAId: row.subsystemId,
        entityBId: row.layerId,
        systemId: row.systemId as SystemId,
        encryptedData: row.encryptedData ? encryptedBlobToBase64(row.encryptedData) : null,
        createdAt: row.createdAt as UnixMillis,
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Link already exists");
      }
      throw error;
    }
  });
}

export async function deleteSubsystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(subsystemLayerLinks)
      .where(and(eq(subsystemLayerLinks.id, linkId), eq(subsystemLayerLinks.systemId, systemId)))
      .returning({ id: subsystemLayerLinks.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Link not found");
    }

    await audit(tx, {
      eventType: "structure-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: `Structure link ${linkId} deleted`,
      systemId,
    });
  });
}

export async function listSubsystemLayerLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
  filterSubsystemId?: string,
  filterLayerId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [eq(subsystemLayerLinks.systemId, systemId)];

  if (filterSubsystemId) conditions.push(eq(subsystemLayerLinks.subsystemId, filterSubsystemId));
  if (filterLayerId) conditions.push(eq(subsystemLayerLinks.layerId, filterLayerId));
  if (cursor) conditions.push(gt(subsystemLayerLinks.id, cursor));

  const rows = await db
    .select()
    .from(subsystemLayerLinks)
    .where(and(...conditions))
    .orderBy(subsystemLayerLinks.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(
    (r): StructureLinkResult => ({
      id: r.id,
      entityAId: r.subsystemId,
      entityBId: r.layerId,
      systemId: r.systemId as SystemId,
      encryptedData: r.encryptedData ? encryptedBlobToBase64(r.encryptedData) : null,
      createdAt: r.createdAt as UnixMillis,
    }),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}

// ── SUBSYSTEM ↔ SIDE SYSTEM ────────────────────────────────────────

export async function createSubsystemSideSystemLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  assertSystemOwnership(auth, systemId);

  const { parsed, blob } = parseLinkBody(params, CreateSubsystemSideSystemLinkBodySchema);

  const linkId = createId(ID_PREFIXES.structureLink);
  const timestamp = now();

  return db.transaction(async (tx) => {
    await verifyNotArchived(tx, subsystems, parsed.subsystemId, systemId, "Subsystem");
    await verifyNotArchived(tx, sideSystems, parsed.sideSystemId, systemId, "Side system");

    try {
      const [row] = await tx
        .insert(subsystemSideSystemLinks)
        .values({
          id: linkId,
          subsystemId: parsed.subsystemId,
          sideSystemId: parsed.sideSystemId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: "structure-link.created",
        actor: { kind: "account", id: auth.accountId },
        detail: `Subsystem ${parsed.subsystemId} linked to side system ${parsed.sideSystemId}`,
        systemId,
      });

      return {
        id: row.id,
        entityAId: row.subsystemId,
        entityBId: row.sideSystemId,
        systemId: row.systemId as SystemId,
        encryptedData: row.encryptedData ? encryptedBlobToBase64(row.encryptedData) : null,
        createdAt: row.createdAt as UnixMillis,
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Link already exists");
      }
      throw error;
    }
  });
}

export async function deleteSubsystemSideSystemLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(subsystemSideSystemLinks)
      .where(
        and(
          eq(subsystemSideSystemLinks.id, linkId),
          eq(subsystemSideSystemLinks.systemId, systemId),
        ),
      )
      .returning({ id: subsystemSideSystemLinks.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Link not found");
    }

    await audit(tx, {
      eventType: "structure-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: `Structure link ${linkId} deleted`,
      systemId,
    });
  });
}

export async function listSubsystemSideSystemLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
  filterSubsystemId?: string,
  filterSideSystemId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [eq(subsystemSideSystemLinks.systemId, systemId)];

  if (filterSubsystemId)
    conditions.push(eq(subsystemSideSystemLinks.subsystemId, filterSubsystemId));
  if (filterSideSystemId)
    conditions.push(eq(subsystemSideSystemLinks.sideSystemId, filterSideSystemId));
  if (cursor) conditions.push(gt(subsystemSideSystemLinks.id, cursor));

  const rows = await db
    .select()
    .from(subsystemSideSystemLinks)
    .where(and(...conditions))
    .orderBy(subsystemSideSystemLinks.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(
    (r): StructureLinkResult => ({
      id: r.id,
      entityAId: r.subsystemId,
      entityBId: r.sideSystemId,
      systemId: r.systemId as SystemId,
      encryptedData: r.encryptedData ? encryptedBlobToBase64(r.encryptedData) : null,
      createdAt: r.createdAt as UnixMillis,
    }),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}

// ── SIDE SYSTEM ↔ LAYER ────────────────────────────────────────────

export async function createSideSystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  assertSystemOwnership(auth, systemId);

  const { parsed, blob } = parseLinkBody(params, CreateSideSystemLayerLinkBodySchema);

  const linkId = createId(ID_PREFIXES.structureLink);
  const timestamp = now();

  return db.transaction(async (tx) => {
    await verifyNotArchived(tx, sideSystems, parsed.sideSystemId, systemId, "Side system");
    await verifyNotArchived(tx, layers, parsed.layerId, systemId, "Layer");

    try {
      const [row] = await tx
        .insert(sideSystemLayerLinks)
        .values({
          id: linkId,
          sideSystemId: parsed.sideSystemId,
          layerId: parsed.layerId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: "structure-link.created",
        actor: { kind: "account", id: auth.accountId },
        detail: `Side system ${parsed.sideSystemId} linked to layer ${parsed.layerId}`,
        systemId,
      });

      return {
        id: row.id,
        entityAId: row.sideSystemId,
        entityBId: row.layerId,
        systemId: row.systemId as SystemId,
        encryptedData: row.encryptedData ? encryptedBlobToBase64(row.encryptedData) : null,
        createdAt: row.createdAt as UnixMillis,
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Link already exists");
      }
      throw error;
    }
  });
}

export async function deleteSideSystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(auth, systemId);

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(sideSystemLayerLinks)
      .where(and(eq(sideSystemLayerLinks.id, linkId), eq(sideSystemLayerLinks.systemId, systemId)))
      .returning({ id: sideSystemLayerLinks.id });

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Link not found");
    }

    await audit(tx, {
      eventType: "structure-link.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: `Structure link ${linkId} deleted`,
      systemId,
    });
  });
}

export async function listSideSystemLayerLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
  filterSideSystemId?: string,
  filterLayerId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  assertSystemOwnership(auth, systemId);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [eq(sideSystemLayerLinks.systemId, systemId)];

  if (filterSideSystemId)
    conditions.push(eq(sideSystemLayerLinks.sideSystemId, filterSideSystemId));
  if (filterLayerId) conditions.push(eq(sideSystemLayerLinks.layerId, filterLayerId));
  if (cursor) conditions.push(gt(sideSystemLayerLinks.id, cursor));

  const rows = await db
    .select()
    .from(sideSystemLayerLinks)
    .where(and(...conditions))
    .orderBy(sideSystemLayerLinks.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(
    (r): StructureLinkResult => ({
      id: r.id,
      entityAId: r.sideSystemId,
      entityBId: r.layerId,
      systemId: r.systemId as SystemId,
      encryptedData: r.encryptedData ? encryptedBlobToBase64(r.encryptedData) : null,
      createdAt: r.createdAt as UnixMillis,
    }),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}
