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
import type { ColumnBaseConfig, ColumnDataType } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type AnyPgColumn = PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object>;

/** Column references required for the active-entity assertion query. */
interface ActiveEntityColumns {
  readonly id: AnyPgColumn;
  readonly systemId: AnyPgColumn;
  readonly archived: AnyPgColumn;
}

/** Shared implementation for asserting an entity exists and is not archived. */
async function assertEntityActive(
  db: PostgresJsDatabase,
  table: PgTable,
  columns: ActiveEntityColumns,
  entityId: string,
  systemId: SystemId,
  entityName: string,
): Promise<void> {
  const [row] = await db
    .select({ id: columns.id })
    .from(table)
    .where(
      and(eq(columns.id, entityId), eq(columns.systemId, systemId), eq(columns.archived, false)),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", `${entityName} not found`);
  }
}

export async function assertMemberActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  memberId: MemberId,
): Promise<void> {
  await assertEntityActive(db, members, members, memberId, systemId, "Member");
}

export async function assertGroupActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  groupId: GroupId,
): Promise<void> {
  await assertEntityActive(db, groups, groups, groupId, systemId, "Group");
}

export async function assertStructureEntityActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: SystemStructureEntityId,
): Promise<void> {
  await assertEntityActive(
    db,
    systemStructureEntities,
    systemStructureEntities,
    entityId,
    systemId,
    "Structure entity",
  );
}

export async function assertFieldDefinitionActive(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldDefId: FieldDefinitionId,
): Promise<void> {
  await assertEntityActive(
    db,
    fieldDefinitions,
    fieldDefinitions,
    fieldDefId,
    systemId,
    "Field definition",
  );
}
