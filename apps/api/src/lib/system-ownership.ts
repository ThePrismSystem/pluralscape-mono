import { systems } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Verify that the given system is owned by the authenticated account and is not archived.
 * Throws 404 NOT_FOUND on miss (never 403, to avoid revealing existence).
 */
export async function assertSystemOwnership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<void> {
  const [row] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(
      and(
        eq(systems.id, systemId),
        eq(systems.accountId, auth.accountId),
        eq(systems.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }
}
