import { fieldDefinitions, groups, members, systemStructureEntities } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type {
  FieldDefinitionId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function assertMemberActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
): Promise<void> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.id, memberId), eq(members.systemId, systemId), eq(members.archived, false)),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Member not found");
  }
}

export async function assertGroupActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
): Promise<void> {
  const [row] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.systemId, systemId), eq(groups.archived, false)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Group not found");
  }
}

export async function assertStructureEntityActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
): Promise<void> {
  const [row] = await db
    .select({ id: systemStructureEntities.id })
    .from(systemStructureEntities)
    .where(
      and(
        eq(systemStructureEntities.id, entityId),
        eq(systemStructureEntities.systemId, systemId),
        eq(systemStructureEntities.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Structure entity not found");
  }
}

export async function assertFieldDefinitionActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldDefId: FieldDefinitionId,
): Promise<void> {
  const [row] = await db
    .select({ id: fieldDefinitions.id })
    .from(fieldDefinitions)
    .where(
      and(
        eq(fieldDefinitions.id, fieldDefId),
        eq(fieldDefinitions.systemId, systemId),
        eq(fieldDefinitions.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
  }
}
