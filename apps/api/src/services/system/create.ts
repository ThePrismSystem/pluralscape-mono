import { systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";

import { HTTP_FORBIDDEN } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withAccountTransaction } from "../../lib/rls-context.js";

import { toSystemProfileResult } from "./internal.js";

import type { SystemProfileResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createSystem(
  db: PostgresJsDatabase,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SystemProfileResult> {
  if (auth.accountType !== "system") {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "Only system accounts can create systems");
  }

  const systemId = createId(ID_PREFIXES.system);
  const timestamp = now();

  const [row] = await withAccountTransaction(db, auth.accountId, async (tx) => {
    const inserted = await tx
      .insert(systems)
      .values({
        id: systemId,
        accountId: auth.accountId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    await audit(tx, {
      eventType: "system.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "System created",
      systemId: brandId<SystemId>(systemId),
    });

    return inserted;
  });

  if (!row) {
    throw new Error("Failed to create system — INSERT returned no rows");
  }

  return toSystemProfileResult(row);
}
