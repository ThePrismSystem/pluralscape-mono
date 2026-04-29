import { fieldValues, groupMemberships, groups } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES } from "@pluralscape/types";

import { MAX_GROUPS_PER_SYSTEM } from "../../quota.constants.js";
import { createHierarchyService } from "../hierarchy-service-factory.js";
import { mapBaseFields } from "../hierarchy-service-helpers.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  GroupId,
  GroupServerMetadata,
} from "@pluralscape/types";
import type { CreateGroupBodySchema, UpdateGroupBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

// ── Types ───────────────────────────────────────────────────────────

export type GroupResult = EncryptedWire<GroupServerMetadata>;
type CreateGroupBody = z.infer<typeof CreateGroupBodySchema>;
type UpdateGroupBody = z.infer<typeof UpdateGroupBodySchema>;

// ── Helpers ─────────────────────────────────────────────────────────

export function toGroupResult(row: {
  id: string;
  systemId: string;
  parentGroupId: string | null;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): GroupResult {
  return {
    ...mapBaseFields(row),
    id: brandId<GroupId>(row.id),
    parentGroupId: row.parentGroupId ? brandId<GroupId>(row.parentGroupId) : null,
    sortOrder: row.sortOrder,
  };
}

// ── Shared hierarchy service ────────────────────────────────────────

export const groupHierarchy = createHierarchyService<
  {
    id: string;
    systemId: string;
    parentGroupId: string | null;
    sortOrder: number;
    encryptedData: EncryptedBlob;
    version: number;
    createdAt: number;
    updatedAt: number;
    archived: boolean;
    archivedAt: number | null;
  },
  GroupId,
  GroupResult,
  CreateGroupBody,
  UpdateGroupBody
>({
  table: groups,
  columns: {
    id: groups.id,
    systemId: groups.systemId,
    parentId: groups.parentGroupId,
    encryptedData: groups.encryptedData,
    version: groups.version,
    archived: groups.archived,
    archivedAt: groups.archivedAt,
    createdAt: groups.createdAt,
    updatedAt: groups.updatedAt,
  },
  idPrefix: ID_PREFIXES.group,
  entityName: "Group",
  maxPerSystem: MAX_GROUPS_PER_SYSTEM,
  parentFieldName: "parentGroupId",
  toResult: toGroupResult,
  createInsertValues: (body) => ({
    sortOrder: body.sortOrder,
  }),
  updateSetValues: () => ({}),
  dependentChecks: [
    {
      table: groups,
      entityColumn: groups.parentGroupId,
      systemColumn: groups.systemId,
      label: "child group(s)",
      filterArchived: groups.archived,
    },
    {
      table: groupMemberships,
      entityColumn: groupMemberships.groupId,
      systemColumn: groupMemberships.systemId,
      label: "member(s)",
    },
    {
      table: fieldValues,
      entityColumn: fieldValues.groupId,
      systemColumn: fieldValues.systemId,
      label: "field value(s)",
    },
  ],
  events: {
    created: "group.created",
    updated: "group.updated",
    deleted: "group.deleted",
    archived: "group.archived",
    restored: "group.restored",
  },
  webhookEvents: {
    created: "group.created",
    updated: "group.updated",
    buildPayload: (entityId: string) => ({ groupId: brandId<GroupId>(entityId) }),
  },
});
