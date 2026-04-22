import { members, systems } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { tenantCtx } from "../../lib/tenant-context.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // 1. Verify ownership of non-archived system
    const [existing] = await tx
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }

    // 2. Prevent archiving the last active system
    const [systemCount] = await tx
      .select({ count: count() })
      .from(systems)
      .where(and(eq(systems.accountId, auth.accountId), eq(systems.archived, false)));

    if (!systemCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (systemCount.count <= 1) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        "Cannot delete the only system on the account",
      );
    }

    // 3. Check for non-archived members
    const { dependents } = await checkDependents(tx, [
      {
        table: members,
        predicate: and(eq(members.systemId, systemId), eq(members.archived, false)),
        typeName: "activeMembers",
      },
    ]);

    const [memberDep] = dependents;
    if (memberDep) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `System has ${String(memberDep.count)} active member(s). Delete all members before deleting the system.`,
      );
    }

    // 4. Audit log BEFORE archive (FK satisfied since system still exists)
    await audit(tx, {
      eventType: "system.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "System archived (soft-delete)",
      systemId,
    });

    // 5. Archive instead of hard delete
    const timestamp = now();
    const [archived] = await tx
      .update(systems)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
      .returning({ id: systems.id });

    if (!archived) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }
  });
}
