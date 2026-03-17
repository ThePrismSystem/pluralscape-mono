import { fieldDefinitions, members } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { FieldDefinitionId, MemberId, SystemId } from "@pluralscape/types";
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
