import { systems } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function verifySystemOwnership(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<void> {
  const [system] = await db
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

  if (!system) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }
}
