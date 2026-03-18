import { InvalidInputError, deserializeEncryptedBlob } from "@pluralscape/crypto";
import {
  layers,
  sideSystemLayerLinks,
  sideSystems,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import {
  CreateSideSystemLayerLinkBodySchema,
  CreateSubsystemLayerLinkBodySchema,
  CreateSubsystemSideSystemLinkBodySchema,
} from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { PG_UNIQUE_VIOLATION } from "../db.constants.js";
import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

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

type TransactionLike = Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];
type EntityTable = typeof subsystems | typeof sideSystems | typeof layers;

export interface StructureLinkResult {
  readonly id: string;
  readonly entityAId: string;
  readonly entityBId: string;
  readonly systemId: SystemId;
  readonly encryptedData: string | null;
  readonly createdAt: UnixMillis;
}

interface NormalizedLinkRow {
  readonly id: string;
  readonly entityAId: string;
  readonly entityBId: string;
  readonly systemId: string;
  readonly encryptedData: EncryptedBlob | null;
  readonly createdAt: number;
}

interface LinkEntityConfig<TParsed> {
  readonly entityATable: EntityTable;
  readonly entityBTable: EntityTable;
  readonly entityAName: string;
  readonly entityBName: string;
  readonly schema: z.ZodType<TParsed>;
  readonly getEntityIds: (parsed: TParsed) => {
    entityAId: string;
    entityBId: string;
  };
  readonly insert: (
    tx: TransactionLike,
    id: string,
    entityAId: string,
    entityBId: string,
    systemId: SystemId,
    blob: EncryptedBlob | null,
    timestamp: number,
  ) => Promise<NormalizedLinkRow | undefined>;
  readonly remove: (
    tx: TransactionLike,
    linkId: string,
    systemId: SystemId,
  ) => Promise<{ id: string }[]>;
  readonly query: (
    db: PostgresJsDatabase,
    systemId: SystemId,
    cursor: PaginationCursor | undefined,
    limit: number,
    filterEntityAId?: string,
    filterEntityBId?: string,
  ) => Promise<NormalizedLinkRow[]>;
}

/** Identity function that validates and infers `TParsed` from the schema. */
function defineLinkConfig<TParsed>(cfg: LinkEntityConfig<TParsed>): LinkEntityConfig<TParsed> {
  return cfg;
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
  tx: TransactionLike,
  table: EntityTable,
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

function toLinkResult(row: NormalizedLinkRow): StructureLinkResult {
  return {
    id: row.id,
    entityAId: row.entityAId,
    entityBId: row.entityBId,
    systemId: row.systemId as SystemId,
    encryptedData: row.encryptedData ? encryptedBlobToBase64(row.encryptedData) : null,
    createdAt: row.createdAt as UnixMillis,
  };
}

// ── Normalizers ─────────────────────────────────────────────────────

function normalizeSubsystemLayer(r: typeof subsystemLayerLinks.$inferSelect): NormalizedLinkRow {
  return {
    id: r.id,
    entityAId: r.subsystemId,
    entityBId: r.layerId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

function normalizeSubsystemSideSystem(
  r: typeof subsystemSideSystemLinks.$inferSelect,
): NormalizedLinkRow {
  return {
    id: r.id,
    entityAId: r.subsystemId,
    entityBId: r.sideSystemId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

function normalizeSideSystemLayer(r: typeof sideSystemLayerLinks.$inferSelect): NormalizedLinkRow {
  return {
    id: r.id,
    entityAId: r.sideSystemId,
    entityBId: r.layerId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

// ── Entity configs ──────────────────────────────────────────────────

const LINK_CONFIGS = {
  subsystemLayer: defineLinkConfig({
    entityATable: subsystems,
    entityBTable: layers,
    entityAName: "Subsystem",
    entityBName: "Layer",
    schema: CreateSubsystemLayerLinkBodySchema,
    getEntityIds: (p) => ({ entityAId: p.subsystemId, entityBId: p.layerId }),
    insert: async (tx, id, entityAId, entityBId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(subsystemLayerLinks)
        .values({
          id,
          subsystemId: entityAId,
          layerId: entityBId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();
      return row ? normalizeSubsystemLayer(row) : undefined;
    },
    remove: (tx, linkId, systemId) =>
      tx
        .delete(subsystemLayerLinks)
        .where(and(eq(subsystemLayerLinks.id, linkId), eq(subsystemLayerLinks.systemId, systemId)))
        .returning({ id: subsystemLayerLinks.id }),
    query: async (db, systemId, cursor, limit, filterA, filterB) => {
      const conds = [eq(subsystemLayerLinks.systemId, systemId)];
      if (filterA) conds.push(eq(subsystemLayerLinks.subsystemId, filterA));
      if (filterB) conds.push(eq(subsystemLayerLinks.layerId, filterB));
      if (cursor) conds.push(gt(subsystemLayerLinks.id, cursor));
      const rows = await db
        .select()
        .from(subsystemLayerLinks)
        .where(and(...conds))
        .orderBy(subsystemLayerLinks.id)
        .limit(limit);
      return rows.map(normalizeSubsystemLayer);
    },
  }),
  subsystemSideSystem: defineLinkConfig({
    entityATable: subsystems,
    entityBTable: sideSystems,
    entityAName: "Subsystem",
    entityBName: "Side system",
    schema: CreateSubsystemSideSystemLinkBodySchema,
    getEntityIds: (p) => ({
      entityAId: p.subsystemId,
      entityBId: p.sideSystemId,
    }),
    insert: async (tx, id, entityAId, entityBId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(subsystemSideSystemLinks)
        .values({
          id,
          subsystemId: entityAId,
          sideSystemId: entityBId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();
      return row ? normalizeSubsystemSideSystem(row) : undefined;
    },
    remove: (tx, linkId, systemId) =>
      tx
        .delete(subsystemSideSystemLinks)
        .where(
          and(
            eq(subsystemSideSystemLinks.id, linkId),
            eq(subsystemSideSystemLinks.systemId, systemId),
          ),
        )
        .returning({ id: subsystemSideSystemLinks.id }),
    query: async (db, systemId, cursor, limit, filterA, filterB) => {
      const conds = [eq(subsystemSideSystemLinks.systemId, systemId)];
      if (filterA) conds.push(eq(subsystemSideSystemLinks.subsystemId, filterA));
      if (filterB) conds.push(eq(subsystemSideSystemLinks.sideSystemId, filterB));
      if (cursor) conds.push(gt(subsystemSideSystemLinks.id, cursor));
      const rows = await db
        .select()
        .from(subsystemSideSystemLinks)
        .where(and(...conds))
        .orderBy(subsystemSideSystemLinks.id)
        .limit(limit);
      return rows.map(normalizeSubsystemSideSystem);
    },
  }),
  sideSystemLayer: defineLinkConfig({
    entityATable: sideSystems,
    entityBTable: layers,
    entityAName: "Side system",
    entityBName: "Layer",
    schema: CreateSideSystemLayerLinkBodySchema,
    getEntityIds: (p) => ({ entityAId: p.sideSystemId, entityBId: p.layerId }),
    insert: async (tx, id, entityAId, entityBId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(sideSystemLayerLinks)
        .values({
          id,
          sideSystemId: entityAId,
          layerId: entityBId,
          systemId,
          encryptedData: blob ?? null,
          createdAt: timestamp,
        })
        .returning();
      return row ? normalizeSideSystemLayer(row) : undefined;
    },
    remove: (tx, linkId, systemId) =>
      tx
        .delete(sideSystemLayerLinks)
        .where(
          and(eq(sideSystemLayerLinks.id, linkId), eq(sideSystemLayerLinks.systemId, systemId)),
        )
        .returning({ id: sideSystemLayerLinks.id }),
    query: async (db, systemId, cursor, limit, filterA, filterB) => {
      const conds = [eq(sideSystemLayerLinks.systemId, systemId)];
      if (filterA) conds.push(eq(sideSystemLayerLinks.sideSystemId, filterA));
      if (filterB) conds.push(eq(sideSystemLayerLinks.layerId, filterB));
      if (cursor) conds.push(gt(sideSystemLayerLinks.id, cursor));
      const rows = await db
        .select()
        .from(sideSystemLayerLinks)
        .where(and(...conds))
        .orderBy(sideSystemLayerLinks.id)
        .limit(limit);
      return rows.map(normalizeSideSystemLayer);
    },
  }),
};

// ── Generic implementations ─────────────────────────────────────────

async function createLinkGeneric<TParsed>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: LinkEntityConfig<TParsed>,
): Promise<StructureLinkResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseLinkBody(params, cfg.schema);
  const { entityAId, entityBId } = cfg.getEntityIds(parsed);

  const linkId = createId(ID_PREFIXES.structureLink);
  const timestamp = now();

  return db.transaction(async (tx) => {
    await verifyNotArchived(tx, cfg.entityATable, entityAId, systemId, cfg.entityAName);
    await verifyNotArchived(tx, cfg.entityBTable, entityBId, systemId, cfg.entityBName);

    try {
      const row = await cfg.insert(tx, linkId, entityAId, entityBId, systemId, blob, timestamp);

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: "structure-link.created",
        actor: { kind: "account", id: auth.accountId },
        detail: `${cfg.entityAName} ${entityAId} linked to ${cfg.entityBName.toLowerCase()} ${entityBId}`,
        systemId,
      });

      return toLinkResult(row);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Link already exists");
      }
      throw error;
    }
  });
}

async function deleteLinkGeneric<TParsed>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: LinkEntityConfig<TParsed>,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
    const deleted = await cfg.remove(tx, linkId, systemId);

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

async function listLinksGeneric<TParsed>(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cfg: LinkEntityConfig<TParsed>,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
  filterEntityAId?: string,
  filterEntityBId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  await assertSystemOwnership(db, systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const rows = await cfg.query(
    db,
    systemId,
    cursor,
    effectiveLimit + 1,
    filterEntityAId,
    filterEntityBId,
  );

  return buildPaginatedResult(rows, effectiveLimit, toLinkResult);
}

// ── Public API ──────────────────────────────────────────────────────

export function createSubsystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  return createLinkGeneric(db, systemId, params, auth, audit, LINK_CONFIGS.subsystemLayer);
}

export function createSubsystemSideSystemLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  return createLinkGeneric(db, systemId, params, auth, audit, LINK_CONFIGS.subsystemSideSystem);
}

export function createSideSystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureLinkResult> {
  return createLinkGeneric(db, systemId, params, auth, audit, LINK_CONFIGS.sideSystemLayer);
}

export function deleteSubsystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return deleteLinkGeneric(db, systemId, linkId, auth, audit, LINK_CONFIGS.subsystemLayer);
}

export function deleteSubsystemSideSystemLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return deleteLinkGeneric(db, systemId, linkId, auth, audit, LINK_CONFIGS.subsystemSideSystem);
}

export function deleteSideSystemLayerLink(
  db: PostgresJsDatabase,
  systemId: SystemId,
  linkId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return deleteLinkGeneric(db, systemId, linkId, auth, audit, LINK_CONFIGS.sideSystemLayer);
}

export function listSubsystemLayerLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
  filterSubsystemId?: string,
  filterLayerId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  return listLinksGeneric(
    db,
    systemId,
    auth,
    LINK_CONFIGS.subsystemLayer,
    cursor,
    limit,
    filterSubsystemId,
    filterLayerId,
  );
}

export function listSubsystemSideSystemLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
  filterSubsystemId?: string,
  filterSideSystemId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  return listLinksGeneric(
    db,
    systemId,
    auth,
    LINK_CONFIGS.subsystemSideSystem,
    cursor,
    limit,
    filterSubsystemId,
    filterSideSystemId,
  );
}

export function listSideSystemLayerLinks(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
  filterSideSystemId?: string,
  filterLayerId?: string,
): Promise<PaginatedResult<StructureLinkResult>> {
  return listLinksGeneric(
    db,
    systemId,
    auth,
    LINK_CONFIGS.sideSystemLayer,
    cursor,
    limit,
    filterSideSystemId,
    filterLayerId,
  );
}
