import {
  layerMemberships,
  layers,
  members,
  sideSystemMemberships,
  sideSystems,
  subsystemMemberships,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { AddStructureMembershipBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { PG_UNIQUE_VIOLATION } from "../db.constants.js";
import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AuditEventType,
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

type TransactionLike = Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];

export interface StructureMembershipResult {
  readonly id: string;
  readonly entityId: string;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly createdAt: UnixMillis;
}

interface NormalizedRow {
  readonly id: string;
  readonly entityId: string;
  readonly systemId: string;
  readonly encryptedData: EncryptedBlob;
  readonly createdAt: number;
}

interface MembershipEntityConfig {
  readonly idPrefix: string;
  readonly entityName: string;
  readonly addEventType: AuditEventType;
  readonly removeEventType: AuditEventType;
  readonly entityTable: typeof subsystems | typeof sideSystems | typeof layers;
  readonly insert: (
    tx: TransactionLike,
    id: string,
    entityId: string,
    systemId: SystemId,
    blob: EncryptedBlob,
    timestamp: number,
  ) => Promise<NormalizedRow | undefined>;
  readonly remove: (
    tx: TransactionLike,
    membershipId: string,
    systemId: SystemId,
  ) => Promise<{ id: string }[]>;
  readonly query: (
    db: PostgresJsDatabase,
    entityId: string,
    systemId: SystemId,
    cursor: PaginationCursor | undefined,
    limit: number,
  ) => Promise<NormalizedRow[]>;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toMembershipResult(row: NormalizedRow): StructureMembershipResult {
  return {
    id: row.id,
    entityId: row.entityId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    createdAt: row.createdAt as UnixMillis,
  };
}

async function verifyMemberExists(
  tx: TransactionLike,
  memberId: string,
  systemId: SystemId,
): Promise<void> {
  const [member] = await tx
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
    )
    .limit(1);

  if (!member) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
  }
}

async function verifyEntityExists(
  dbOrTx: PostgresJsDatabase | TransactionLike,
  table: typeof subsystems | typeof sideSystems | typeof layers,
  entityId: string,
  systemId: SystemId,
  entityName: string,
): Promise<void> {
  const [entity] = await dbOrTx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.systemId, systemId), eq(table.archived, false)))
    .limit(1);

  if (!entity) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
  }
}

// ── Entity configs ──────────────────────────────────────────────────

function normalizeSubsystem(r: typeof subsystemMemberships.$inferSelect): NormalizedRow {
  return {
    id: r.id,
    entityId: r.subsystemId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

function normalizeSideSystem(r: typeof sideSystemMemberships.$inferSelect): NormalizedRow {
  return {
    id: r.id,
    entityId: r.sideSystemId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

function normalizeLayer(r: typeof layerMemberships.$inferSelect): NormalizedRow {
  return {
    id: r.id,
    entityId: r.layerId,
    systemId: r.systemId,
    encryptedData: r.encryptedData,
    createdAt: r.createdAt,
  };
}

const ENTITY_CONFIGS = {
  subsystem: {
    idPrefix: ID_PREFIXES.subsystemMembership,
    entityName: "Subsystem",
    addEventType: "subsystem-membership.added",
    removeEventType: "subsystem-membership.removed",
    entityTable: subsystems,
    insert: async (tx, id, entityId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(subsystemMemberships)
        .values({ id, subsystemId: entityId, systemId, encryptedData: blob, createdAt: timestamp })
        .returning();
      return row ? normalizeSubsystem(row) : undefined;
    },
    remove: (tx, membershipId, systemId) =>
      tx
        .delete(subsystemMemberships)
        .where(
          and(
            eq(subsystemMemberships.id, membershipId),
            eq(subsystemMemberships.systemId, systemId),
          ),
        )
        .returning({ id: subsystemMemberships.id }),
    query: async (db, entityId, systemId, cursor, limit) => {
      const conds = [
        eq(subsystemMemberships.subsystemId, entityId),
        eq(subsystemMemberships.systemId, systemId),
      ];
      if (cursor) conds.push(gt(subsystemMemberships.id, cursor));
      const rows = await db
        .select()
        .from(subsystemMemberships)
        .where(and(...conds))
        .orderBy(subsystemMemberships.id)
        .limit(limit);
      return rows.map(normalizeSubsystem);
    },
  },
  sideSystem: {
    idPrefix: ID_PREFIXES.sideSystemMembership,
    entityName: "Side system",
    addEventType: "side-system-membership.added",
    removeEventType: "side-system-membership.removed",
    entityTable: sideSystems,
    insert: async (tx, id, entityId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(sideSystemMemberships)
        .values({ id, sideSystemId: entityId, systemId, encryptedData: blob, createdAt: timestamp })
        .returning();
      return row ? normalizeSideSystem(row) : undefined;
    },
    remove: (tx, membershipId, systemId) =>
      tx
        .delete(sideSystemMemberships)
        .where(
          and(
            eq(sideSystemMemberships.id, membershipId),
            eq(sideSystemMemberships.systemId, systemId),
          ),
        )
        .returning({ id: sideSystemMemberships.id }),
    query: async (db, entityId, systemId, cursor, limit) => {
      const conds = [
        eq(sideSystemMemberships.sideSystemId, entityId),
        eq(sideSystemMemberships.systemId, systemId),
      ];
      if (cursor) conds.push(gt(sideSystemMemberships.id, cursor));
      const rows = await db
        .select()
        .from(sideSystemMemberships)
        .where(and(...conds))
        .orderBy(sideSystemMemberships.id)
        .limit(limit);
      return rows.map(normalizeSideSystem);
    },
  },
  layer: {
    idPrefix: ID_PREFIXES.layerMembership,
    entityName: "Layer",
    addEventType: "layer-membership.added",
    removeEventType: "layer-membership.removed",
    entityTable: layers,
    insert: async (tx, id, entityId, systemId, blob, timestamp) => {
      const [row] = await tx
        .insert(layerMemberships)
        .values({ id, layerId: entityId, systemId, encryptedData: blob, createdAt: timestamp })
        .returning();
      return row ? normalizeLayer(row) : undefined;
    },
    remove: (tx, membershipId, systemId) =>
      tx
        .delete(layerMemberships)
        .where(and(eq(layerMemberships.id, membershipId), eq(layerMemberships.systemId, systemId)))
        .returning({ id: layerMemberships.id }),
    query: async (db, entityId, systemId, cursor, limit) => {
      const conds = [
        eq(layerMemberships.layerId, entityId),
        eq(layerMemberships.systemId, systemId),
      ];
      if (cursor) conds.push(gt(layerMemberships.id, cursor));
      const rows = await db
        .select()
        .from(layerMemberships)
        .where(and(...conds))
        .orderBy(layerMemberships.id)
        .limit(limit);
      return rows.map(normalizeLayer);
    },
  },
} satisfies Record<string, MembershipEntityConfig>;

// ── Generic implementations ─────────────────────────────────────────

async function addMembershipGeneric(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: MembershipEntityConfig,
): Promise<StructureMembershipResult> {
  await assertSystemOwnership(db, systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    AddStructureMembershipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const membershipId = createId(cfg.idPrefix);
  const timestamp = now();

  return db.transaction(async (tx) => {
    await verifyEntityExists(tx, cfg.entityTable, entityId, systemId, cfg.entityName);
    await verifyMemberExists(tx, parsed.memberId, systemId);

    try {
      const row = await cfg.insert(tx, membershipId, entityId, systemId, blob, timestamp);

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: cfg.addEventType,
        actor: { kind: "account", id: auth.accountId },
        detail: `Member ${parsed.memberId} added to ${cfg.entityName} ${entityId}`,
        systemId,
      });

      return toMembershipResult(row);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Membership already exists");
      }
      throw error;
    }
  });
}

async function removeMembershipGeneric(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
  cfg: MembershipEntityConfig,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);

  await db.transaction(async (tx) => {
    const deleted = await cfg.remove(tx, membershipId, systemId);

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Membership not found");
    }

    await audit(tx, {
      eventType: cfg.removeEventType,
      actor: { kind: "account", id: auth.accountId },
      detail: `Membership ${membershipId} removed`,
      systemId,
    });
  });
}

async function listMembershipsGeneric(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: string,
  auth: AuthContext,
  cfg: MembershipEntityConfig,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<StructureMembershipResult>> {
  await assertSystemOwnership(db, systemId, auth);

  await verifyEntityExists(db, cfg.entityTable, entityId, systemId, cfg.entityName);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const rows = await cfg.query(db, entityId, systemId, cursor, effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toMembershipResult);
}

// ── Public API ──────────────────────────────────────────────────────

export function addSubsystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  return addMembershipGeneric(
    db,
    systemId,
    subsystemId,
    params,
    auth,
    audit,
    ENTITY_CONFIGS.subsystem,
  );
}

export function addSideSystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  return addMembershipGeneric(
    db,
    systemId,
    sideSystemId,
    params,
    auth,
    audit,
    ENTITY_CONFIGS.sideSystem,
  );
}

export function addLayerMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  return addMembershipGeneric(db, systemId, layerId, params, auth, audit, ENTITY_CONFIGS.layer);
}

export function removeSubsystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return removeMembershipGeneric(db, systemId, membershipId, auth, audit, ENTITY_CONFIGS.subsystem);
}

export function removeSideSystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return removeMembershipGeneric(
    db,
    systemId,
    membershipId,
    auth,
    audit,
    ENTITY_CONFIGS.sideSystem,
  );
}

export function removeLayerMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  return removeMembershipGeneric(db, systemId, membershipId, auth, audit, ENTITY_CONFIGS.layer);
}

export function listSubsystemMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
): Promise<PaginatedResult<StructureMembershipResult>> {
  return listMembershipsGeneric(
    db,
    systemId,
    subsystemId,
    auth,
    ENTITY_CONFIGS.subsystem,
    cursor,
    limit,
  );
}

export function listSideSystemMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
): Promise<PaginatedResult<StructureMembershipResult>> {
  return listMembershipsGeneric(
    db,
    systemId,
    sideSystemId,
    auth,
    ENTITY_CONFIGS.sideSystem,
    cursor,
    limit,
  );
}

export function listLayerMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
): Promise<PaginatedResult<StructureMembershipResult>> {
  return listMembershipsGeneric(db, systemId, layerId, auth, ENTITY_CONFIGS.layer, cursor, limit);
}
