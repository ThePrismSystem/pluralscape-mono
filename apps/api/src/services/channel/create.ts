import { channels, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId } from "@pluralscape/types";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_CHANNELS_PER_SYSTEM } from "../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toChannelResult } from "./internal.js";

import type { ChannelResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, ChannelId } from "@pluralscape/types";
import type { CreateChannelBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function createChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateChannelBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  if (body.type === "category" && body.parentId) {
    throw new ApiHttpError(HTTP_CONFLICT, "INVALID_HIERARCHY", "Categories cannot have a parent");
  }

  const channelId = brandId<ChannelId>(createId(ID_PREFIXES.channel));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(channels)
      .where(and(eq(channels.systemId, systemId), eq(channels.archived, false)));

    if ((existing?.count ?? 0) >= MAX_CHANNELS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_CHANNELS_PER_SYSTEM)} channels per system`,
      );
    }

    if (body.parentId) {
      const [parent] = await tx
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(
          and(
            eq(channels.id, body.parentId),
            eq(channels.systemId, systemId),
            eq(channels.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent channel not found");
      }

      if (parent.type !== "category") {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "INVALID_HIERARCHY",
          "Channels can only be nested under categories",
        );
      }
    }

    const [row] = await tx
      .insert(channels)
      .values({
        id: channelId,
        systemId,
        type: body.type,
        parentId: body.parentId ?? null,
        sortOrder: body.sortOrder,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create channel — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "channel.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Channel created (type: ${body.type})`,
      systemId,
    });
    const result = toChannelResult(row);
    await dispatchWebhookEvent(tx, systemId, "channel.created", {
      channelId: result.id,
    });

    return result;
  });
}
