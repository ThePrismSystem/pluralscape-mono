import { channels, messages } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { checkDependents } from "../../lib/check-dependents.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    // Check for non-archived dependents
    const { dependents } = await checkDependents(tx, [
      {
        table: channels,
        predicate: and(
          eq(channels.parentId, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
        ),
        typeName: "channels",
      },
      {
        table: messages,
        predicate: and(
          eq(messages.channelId, channelId),
          eq(messages.systemId, systemId),
          eq(messages.archived, false),
        ),
        typeName: "messages",
      },
    ]);

    if (dependents.length > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Channel has dependents. Remove all dependents before deleting.",
        { dependents },
      );
    }

    await audit(tx, {
      eventType: "channel.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Channel deleted",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "channel.deleted", {
      channelId: channelId,
    });

    await tx
      .delete(channels)
      .where(and(eq(channels.id, channelId), eq(channels.systemId, systemId)));
  });
}
