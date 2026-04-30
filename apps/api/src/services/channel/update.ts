import { channels } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toChannelResult } from "./internal.js";

import type { ChannelResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, SystemId } from "@pluralscape/types";
import type { UpdateChannelBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  body: z.infer<typeof UpdateChannelBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const setValues = {
      encryptedData: blob,
      updatedAt: timestamp,
      version: sql`${channels.version} + 1`,
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    };

    const updated = await tx
      .update(channels)
      .set(setValues)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.version, version),
          eq(channels.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
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
        return existing;
      },
      "Channel",
    );

    await audit(tx, {
      eventType: "channel.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Channel updated",
      systemId,
    });
    const result = toChannelResult(row);
    await dispatchWebhookEvent(tx, systemId, "channel.updated", {
      channelId: result.id,
    });

    return result;
  });
}
