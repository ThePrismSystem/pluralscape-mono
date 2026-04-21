import { channels } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";

import { CHANNEL_LIFECYCLE, toChannelResult } from "./internal.js";

import type { ChannelResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function archiveChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, channelId, auth, audit, CHANNEL_LIFECYCLE);
}

export async function restoreChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ChannelResult> {
  return restoreEntity(db, systemId, channelId, auth, audit, CHANNEL_LIFECYCLE, (row) =>
    toChannelResult(row as typeof channels.$inferSelect),
  );
}
