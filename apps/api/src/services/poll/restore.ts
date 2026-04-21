import { polls } from "@pluralscape/db/pg";

import { restoreEntity } from "../../lib/entity-lifecycle.js";

import { POLL_LIFECYCLE, toPollResult } from "./internal.js";

import type { PollResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PollId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function restorePoll(
  db: PostgresJsDatabase,
  systemId: SystemId,
  pollId: PollId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<PollResult> {
  return restoreEntity(db, systemId, pollId, auth, audit, POLL_LIFECYCLE, (row) =>
    toPollResult(row as typeof polls.$inferSelect),
  );
}
