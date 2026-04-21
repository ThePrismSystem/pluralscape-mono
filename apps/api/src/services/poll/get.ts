import { polls } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import { toPollResult } from "./internal.js";

import type { PollResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function getPoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
): Promise<PollResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(polls)
      .where(and(eq(polls.id, pollId), eq(polls.systemId, systemId), eq(polls.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Poll not found");
    }

    return toPollResult(row);
  });
}
