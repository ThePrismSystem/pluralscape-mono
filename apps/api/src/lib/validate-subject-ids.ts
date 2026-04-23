import { customFronts, members, systemStructureEntities } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { SystemId, SystemStructureEntityId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface SubjectIds {
  readonly memberId?: string | null;
  readonly customFrontId?: string | null;
  readonly structureEntityId?: string | null;
}

/**
 * Validates that provided subject IDs exist within the given system.
 * Throws 400 INVALID_SUBJECT if any ID is not found.
 */
export async function validateSubjectIds(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  subjects: SubjectIds,
): Promise<void> {
  if (subjects.memberId) {
    const [row] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, subjects.memberId),
          eq(members.systemId, systemId),
          eq(members.archived, false),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "INVALID_SUBJECT",
        `Member ${subjects.memberId} not found in this system`,
      );
    }
  }

  if (subjects.customFrontId) {
    const [row] = await tx
      .select({ id: customFronts.id })
      .from(customFronts)
      .where(
        and(
          eq(customFronts.id, subjects.customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.archived, false),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "INVALID_SUBJECT",
        `Custom front ${subjects.customFrontId} not found in this system`,
      );
    }
  }

  if (subjects.structureEntityId) {
    const [row] = await tx
      .select({ id: systemStructureEntities.id })
      .from(systemStructureEntities)
      .where(
        and(
          eq(
            systemStructureEntities.id,
            brandId<SystemStructureEntityId>(subjects.structureEntityId),
          ),
          eq(systemStructureEntities.systemId, systemId),
          eq(systemStructureEntities.archived, false),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "INVALID_SUBJECT",
        `Structure entity ${subjects.structureEntityId} not found in this system`,
      );
    }
  }
}
