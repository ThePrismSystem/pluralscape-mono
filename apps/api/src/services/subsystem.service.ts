import {
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
  subsystems,
} from "@pluralscape/db/pg";
import { ID_PREFIXES } from "@pluralscape/types";
import { CreateSubsystemBodySchema, UpdateSubsystemBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { detectAncestorCycle } from "../lib/hierarchy.js";

import { createHierarchyService } from "./hierarchy-service-factory.js";
import { mapBaseFields } from "./hierarchy-service-helpers.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SubsystemId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SubsystemResult {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly parentSubsystemId: SubsystemId | null;
  readonly architectureType: unknown;
  readonly hasCore: boolean;
  readonly discoveryStatus: string | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toSubsystemResult(row: {
  id: string;
  systemId: string;
  parentSubsystemId: string | null;
  architectureType: unknown;
  hasCore: boolean;
  discoveryStatus: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): SubsystemResult {
  return {
    ...mapBaseFields(row),
    id: row.id as SubsystemId,
    parentSubsystemId: row.parentSubsystemId as SubsystemId | null,
    architectureType: row.architectureType,
    hasCore: row.hasCore,
    discoveryStatus: row.discoveryStatus,
  };
}

// ── Shared hierarchy service ────────────────────────────────────────

const subsystemHierarchy = createHierarchyService<
  {
    id: string;
    systemId: string;
    parentSubsystemId: string | null;
    architectureType: unknown;
    hasCore: boolean;
    discoveryStatus: string | null;
    encryptedData: EncryptedBlob;
    version: number;
    createdAt: number;
    updatedAt: number;
    archived: boolean;
    archivedAt: number | null;
  },
  SubsystemId,
  SubsystemResult
>({
  table: subsystems,
  columns: {
    id: subsystems.id,
    systemId: subsystems.systemId,
    parentId: subsystems.parentSubsystemId,
    encryptedData: subsystems.encryptedData,
    version: subsystems.version,
    archived: subsystems.archived,
    archivedAt: subsystems.archivedAt,
    createdAt: subsystems.createdAt,
    updatedAt: subsystems.updatedAt,
  },
  idPrefix: ID_PREFIXES.subsystem,
  entityName: "Subsystem",
  parentFieldName: "parentSubsystemId",
  toResult: toSubsystemResult,
  createSchema: CreateSubsystemBodySchema,
  updateSchema: UpdateSubsystemBodySchema,
  createInsertValues: (parsed) => ({
    architectureType: parsed.architectureType,
    hasCore: parsed.hasCore,
    discoveryStatus: parsed.discoveryStatus,
  }),
  updateSetValues: (parsed) => ({
    parentSubsystemId: parsed.parentSubsystemId,
    architectureType: parsed.architectureType,
    hasCore: parsed.hasCore,
    discoveryStatus: parsed.discoveryStatus,
  }),
  dependentChecks: [
    {
      table: subsystems,
      entityColumn: subsystems.parentSubsystemId,
      systemColumn: subsystems.systemId,
      label: "child subsystem(s)",
      filterArchived: subsystems.archived,
    },
    {
      table: subsystemMemberships,
      entityColumn: subsystemMemberships.subsystemId,
      systemColumn: subsystemMemberships.systemId,
      label: "membership(s)",
    },
    {
      table: subsystemLayerLinks,
      entityColumn: subsystemLayerLinks.subsystemId,
      systemColumn: subsystemLayerLinks.systemId,
      label: "layer link(s)",
    },
    {
      table: subsystemSideSystemLinks,
      entityColumn: subsystemSideSystemLinks.subsystemId,
      systemColumn: subsystemSideSystemLinks.systemId,
      label: "side system link(s)",
    },
  ],
  events: {
    created: "subsystem.created",
    updated: "subsystem.updated",
    deleted: "subsystem.deleted",
    archived: "subsystem.archived",
    restored: "subsystem.restored",
  },
  beforeUpdate: async (tx, entityId, parsed, systemId) => {
    const rawParentId = parsed.parentSubsystemId;
    const parentSubsystemId = typeof rawParentId === "string" ? rawParentId : null;

    // Reject self-parenting
    if (parentSubsystemId === entityId) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Cannot set subsystem as its own parent",
      );
    }

    // If parentSubsystemId is non-null, validate and check for cycles
    if (parentSubsystemId !== null) {
      await detectAncestorCycle(
        async (id) => {
          const [row] = await tx
            .select({ parentSubsystemId: subsystems.parentSubsystemId })
            .from(subsystems)
            .where(and(eq(subsystems.id, id), eq(subsystems.systemId, systemId)))
            .limit(1);
          return row?.parentSubsystemId;
        },
        parentSubsystemId,
        entityId,
        "Subsystem",
      );
    }
  },
});

// ── Delegated CRUD ──────────────────────────────────────────────────

export const createSubsystem = subsystemHierarchy.create;

export const listSubsystems: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: PaginationCursor,
  limit?: number,
) => Promise<PaginatedResult<SubsystemResult>> = subsystemHierarchy.list;

export const getSubsystem = subsystemHierarchy.get;

export const updateSubsystem = subsystemHierarchy.update;

export const deleteSubsystem = subsystemHierarchy.remove;

export const archiveSubsystem = subsystemHierarchy.archive;

export const restoreSubsystem = subsystemHierarchy.restore;
