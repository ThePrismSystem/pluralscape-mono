import {
  layerMemberships,
  layers,
  members,
  sideSystemMemberships,
  sideSystems,
  subsystemMemberships,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { AddStructureMembershipBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
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

export interface StructureMembershipResult {
  readonly id: string;
  readonly entityId: string;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly createdAt: UnixMillis;
}

type EntityType = "subsystem" | "sideSystem" | "layer";

interface EntityConfig {
  readonly idPrefix: string;
  readonly entityName: string;
  readonly addEventType: AuditEventType;
  readonly removeEventType: AuditEventType;
}

const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  subsystem: {
    idPrefix: ID_PREFIXES.subsystemMembership,
    entityName: "Subsystem",
    addEventType: "subsystem-membership.added",
    removeEventType: "subsystem-membership.removed",
  },
  sideSystem: {
    idPrefix: ID_PREFIXES.sideSystemMembership,
    entityName: "Side system",
    addEventType: "side-system-membership.added",
    removeEventType: "side-system-membership.removed",
  },
  layer: {
    idPrefix: ID_PREFIXES.layerMembership,
    entityName: "Layer",
    addEventType: "layer-membership.added",
    removeEventType: "layer-membership.removed",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function toMembershipResult(
  id: string,
  entityId: string,
  sysId: string,
  blob: EncryptedBlob,
  createdAt: number,
): StructureMembershipResult {
  return {
    id,
    entityId,
    systemId: sysId as SystemId,
    encryptedData: encryptedBlobToBase64(blob),
    createdAt: createdAt as UnixMillis,
  };
}

async function verifyMemberExists(
  tx: Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0],
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

// ── SUBSYSTEM MEMBERSHIPS ───────────────────────────────────────────

export async function addSubsystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.subsystem;

  const { parsed, blob } = parseAndValidateBlob(
    params,
    AddStructureMembershipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const membershipId = createId(cfg.idPrefix);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [entity] = await tx
      .select({ id: subsystems.id })
      .from(subsystems)
      .where(
        and(
          eq(subsystems.id, subsystemId),
          eq(subsystems.systemId, systemId),
          eq(subsystems.archived, false),
        ),
      )
      .limit(1);

    if (!entity) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
    }

    await verifyMemberExists(tx, parsed.memberId, systemId);

    try {
      const [row] = await tx
        .insert(subsystemMemberships)
        .values({
          id: membershipId,
          subsystemId,
          systemId,
          encryptedData: blob,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: cfg.addEventType,
        actor: { kind: "account", id: auth.accountId },
        detail: `Member ${parsed.memberId} added to ${cfg.entityName} ${subsystemId}`,
        systemId,
      });

      return toMembershipResult(
        row.id,
        row.subsystemId,
        row.systemId,
        row.encryptedData,
        row.createdAt,
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Membership already exists");
      }
      throw error;
    }
  });
}

export async function removeSubsystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.subsystem;

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(subsystemMemberships)
      .where(
        and(eq(subsystemMemberships.id, membershipId), eq(subsystemMemberships.systemId, systemId)),
      )
      .returning({ id: subsystemMemberships.id });

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

export async function listSubsystemMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  subsystemId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<StructureMembershipResult>> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.subsystem;

  const [entity] = await db
    .select({ id: subsystems.id })
    .from(subsystems)
    .where(
      and(
        eq(subsystems.id, subsystemId),
        eq(subsystems.systemId, systemId),
        eq(subsystems.archived, false),
      ),
    )
    .limit(1);

  if (!entity) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
  }

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [
    eq(subsystemMemberships.subsystemId, subsystemId),
    eq(subsystemMemberships.systemId, systemId),
  ];
  if (cursor) conditions.push(gt(subsystemMemberships.id, cursor));

  const rows = await db
    .select()
    .from(subsystemMemberships)
    .where(and(...conditions))
    .orderBy(subsystemMemberships.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map((r) =>
    toMembershipResult(r.id, r.subsystemId, r.systemId, r.encryptedData, r.createdAt),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}

// ── SIDE SYSTEM MEMBERSHIPS ─────────────────────────────────────────

export async function addSideSystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.sideSystem;

  const { parsed, blob } = parseAndValidateBlob(
    params,
    AddStructureMembershipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const membershipId = createId(cfg.idPrefix);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [entity] = await tx
      .select({ id: sideSystems.id })
      .from(sideSystems)
      .where(
        and(
          eq(sideSystems.id, sideSystemId),
          eq(sideSystems.systemId, systemId),
          eq(sideSystems.archived, false),
        ),
      )
      .limit(1);

    if (!entity) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
    }

    await verifyMemberExists(tx, parsed.memberId, systemId);

    try {
      const [row] = await tx
        .insert(sideSystemMemberships)
        .values({
          id: membershipId,
          sideSystemId,
          systemId,
          encryptedData: blob,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: cfg.addEventType,
        actor: { kind: "account", id: auth.accountId },
        detail: `Member ${parsed.memberId} added to ${cfg.entityName} ${sideSystemId}`,
        systemId,
      });

      return toMembershipResult(
        row.id,
        row.sideSystemId,
        row.systemId,
        row.encryptedData,
        row.createdAt,
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Membership already exists");
      }
      throw error;
    }
  });
}

export async function removeSideSystemMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.sideSystem;

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(sideSystemMemberships)
      .where(
        and(
          eq(sideSystemMemberships.id, membershipId),
          eq(sideSystemMemberships.systemId, systemId),
        ),
      )
      .returning({ id: sideSystemMemberships.id });

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

export async function listSideSystemMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  sideSystemId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<StructureMembershipResult>> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.sideSystem;

  const [entity] = await db
    .select({ id: sideSystems.id })
    .from(sideSystems)
    .where(
      and(
        eq(sideSystems.id, sideSystemId),
        eq(sideSystems.systemId, systemId),
        eq(sideSystems.archived, false),
      ),
    )
    .limit(1);

  if (!entity) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
  }

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [
    eq(sideSystemMemberships.sideSystemId, sideSystemId),
    eq(sideSystemMemberships.systemId, systemId),
  ];
  if (cursor) conditions.push(gt(sideSystemMemberships.id, cursor));

  const rows = await db
    .select()
    .from(sideSystemMemberships)
    .where(and(...conditions))
    .orderBy(sideSystemMemberships.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map((r) =>
    toMembershipResult(r.id, r.sideSystemId, r.systemId, r.encryptedData, r.createdAt),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}

// ── LAYER MEMBERSHIPS ───────────────────────────────────────────────

export async function addLayerMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: string,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<StructureMembershipResult> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.layer;

  const { parsed, blob } = parseAndValidateBlob(
    params,
    AddStructureMembershipBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const membershipId = createId(cfg.idPrefix);
  const timestamp = now();

  return db.transaction(async (tx) => {
    const [entity] = await tx
      .select({ id: layers.id })
      .from(layers)
      .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)))
      .limit(1);

    if (!entity) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
    }

    await verifyMemberExists(tx, parsed.memberId, systemId);

    try {
      const [row] = await tx
        .insert(layerMemberships)
        .values({
          id: membershipId,
          layerId,
          systemId,
          encryptedData: blob,
          createdAt: timestamp,
        })
        .returning();

      if (!row) throw new Error("INSERT returned no rows");

      await audit(tx, {
        eventType: cfg.addEventType,
        actor: { kind: "account", id: auth.accountId },
        detail: `Member ${parsed.memberId} added to ${cfg.entityName} ${layerId}`,
        systemId,
      });

      return toMembershipResult(
        row.id,
        row.layerId,
        row.systemId,
        row.encryptedData,
        row.createdAt,
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Membership already exists");
      }
      throw error;
    }
  });
}

export async function removeLayerMembership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  membershipId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.layer;

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(layerMemberships)
      .where(and(eq(layerMemberships.id, membershipId), eq(layerMemberships.systemId, systemId)))
      .returning({ id: layerMemberships.id });

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

export async function listLayerMemberships(
  db: PostgresJsDatabase,
  systemId: SystemId,
  layerId: string,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<StructureMembershipResult>> {
  await assertSystemOwnership(db, systemId, auth);
  const cfg = ENTITY_CONFIGS.layer;

  const [entity] = await db
    .select({ id: layers.id })
    .from(layers)
    .where(and(eq(layers.id, layerId), eq(layers.systemId, systemId), eq(layers.archived, false)))
    .limit(1);

  if (!entity) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${cfg.entityName} not found`);
  }

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
  const conditions = [
    eq(layerMemberships.layerId, layerId),
    eq(layerMemberships.systemId, systemId),
  ];
  if (cursor) conditions.push(gt(layerMemberships.id, cursor));

  const rows = await db
    .select()
    .from(layerMemberships)
    .where(and(...conditions))
    .orderBy(layerMemberships.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map((r) =>
    toMembershipResult(r.id, r.layerId, r.systemId, r.encryptedData, r.createdAt),
  );
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && lastItem ? toCursor(lastItem.id) : null,
    hasMore,
    totalCount: null,
  };
}
