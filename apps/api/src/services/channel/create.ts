import { channels, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId } from "@pluralscape/types";
import { CreateChannelBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
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
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateChannelBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  // Categories cannot have a parent
  if (parsed.type === "category" && parsed.parentId) {
    throw new ApiHttpError(HTTP_CONFLICT, "INVALID_HIERARCHY", "Categories cannot have a parent");
  }

  const channelId = brandId<ChannelId>(createId(ID_PREFIXES.channel));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system channel quota
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

    // If parentId provided, validate it exists, belongs to system, and is a category
    if (parsed.parentId) {
      const [parent] = await tx
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(
          and(
            eq(channels.id, parsed.parentId),
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
        type: parsed.type,
        parentId: parsed.parentId ?? null,
        sortOrder: parsed.sortOrder,
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
      detail: `Channel created (type: ${parsed.type})`,
      systemId,
    });
    const result = toChannelResult(row);
    await dispatchWebhookEvent(tx, systemId, "channel.created", {
      channelId: result.id,
    });

    return result;
  });
}
