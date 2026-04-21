import { channels } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { ChannelId, SystemId, UnixMillis } from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────────

interface BaseChannelResult {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export interface CategoryResult extends BaseChannelResult {
  readonly type: "category";
  readonly parentId: null;
}

export interface ChannelItemResult extends BaseChannelResult {
  readonly type: "channel";
  readonly parentId: ChannelId | null;
}

export type ChannelResult = CategoryResult | ChannelItemResult;

// ── Helpers ─────────────────────────────────────────────────────────

export function toChannelResult(row: typeof channels.$inferSelect): ChannelResult {
  const base = {
    id: brandId<ChannelId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
  if (row.type === "category") {
    return { ...base, type: "category", parentId: null };
  }
  return {
    ...base,
    type: "channel",
    parentId: row.parentId ? brandId<ChannelId>(row.parentId) : null,
  };
}

// ── Lifecycle config (shared by archive + restore) ──────────────────

export const CHANNEL_LIFECYCLE: ArchivableEntityConfig<ChannelId> = {
  table: channels,
  columns: channels,
  entityName: "Channel",
  archiveEvent: "channel.archived" as const,
  restoreEvent: "channel.restored" as const,
  onArchive: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "channel.archived", { channelId: eid }),
  onRestore: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "channel.restored", { channelId: eid }),
};
