import {
  FRIEND_EXPORTABLE_ENTITY_TYPES,
  entityToRow,
  getTableMetadataForEntityType,
} from "@pluralscape/sync/materializer";

import type { DataLayerEventMap, EventBus, SyncedEntityType } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";

// ── Public types ──────────────────────────────────────────────────────

export interface FriendExportPage {
  readonly data: readonly FriendExportEntity[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface FriendExportEntity {
  readonly id: string;
  readonly entityType: string;
  readonly encryptedData: string;
  readonly updatedAt: number;
}

export interface FriendIndexerConfig {
  readonly eventBus: EventBus<DataLayerEventMap>;
  readonly db: MaterializerDb;
  readonly fetchExport: (connectionId: string, cursor?: string) => Promise<FriendExportPage>;
  readonly decryptEntity: (encryptedData: string, entityType: string) => Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Type-guard: returns true when `payload` looks like a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Type-guard: checks whether a string is a known friend-exportable entity type. */
function isFriendExportableEntityType(value: string): value is SyncedEntityType {
  return FRIEND_EXPORTABLE_ENTITY_TYPES.has(value as SyncedEntityType);
}

// ── Core indexing logic ───────────────────────────────────────────────

async function indexFriend(connectionId: string, config: FriendIndexerConfig): Promise<void> {
  const { db, fetchExport, decryptEntity, eventBus } = config;

  // 1. Delete all existing rows for this connection across all friend_ tables.
  for (const entityType of FRIEND_EXPORTABLE_ENTITY_TYPES) {
    const { tableName } = getTableMetadataForEntityType(entityType);
    db.execute(`DELETE FROM friend_${tableName} WHERE connection_id = ?`, [connectionId]);
  }

  // 2. Fetch all pages and insert decrypted entities.
  let cursor: string | undefined;
  do {
    const page: FriendExportPage = await fetchExport(connectionId, cursor);

    for (const entity of page.data) {
      if (!isFriendExportableEntityType(entity.entityType)) continue;

      const { tableName, columnNames } = getTableMetadataForEntityType(entity.entityType);
      const friendTableName = `friend_${tableName}`;
      const decrypted = decryptEntity(entity.encryptedData, entity.entityType);

      const row = entityToRow(entity.id, decrypted, columnNames);

      const presentColumns = ["connection_id", ...columnNames.filter((col) => col in row)];
      const placeholders = presentColumns.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${friendTableName} (${presentColumns.join(", ")}) VALUES (${placeholders})`;
      const params: unknown[] = [
        connectionId,
        ...columnNames.filter((col) => col in row).map((col) => row[col] ?? null),
      ];

      db.execute(sql, params);
    }

    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor !== undefined);

  // 3. Emit completion events.
  eventBus.emit("friend:indexed", { type: "friend:indexed", connectionId });
  eventBus.emit("search:index-updated", { type: "search:index-updated", scope: "friend" });
}

// ── Public factory ────────────────────────────────────────────────────

/**
 * Creates a friend indexer that listens for friend data change events and
 * re-indexes the friend's exported data into the local `friend_*` tables.
 *
 * @returns A cleanup function that unsubscribes all listeners.
 */
export function createFriendIndexer(config: FriendIndexerConfig): () => void {
  const { eventBus } = config;

  /** Tracks in-flight indexing per connectionId to prevent concurrent races. */
  const inflight = new Map<string, { pending: boolean }>();

  function scheduleIndex(connectionId: string): void {
    const existing = inflight.get(connectionId);

    if (existing) {
      existing.pending = true;
      return;
    }

    const state = { pending: false };
    inflight.set(connectionId, state);

    const run = (): Promise<void> =>
      indexFriend(connectionId, config)
        .catch((err: unknown) => {
          eventBus.emit("sync:error", {
            type: "sync:error",
            message: `Failed to index friend data for connection ${connectionId}`,
            error: err,
          });
        })
        .then(() => {
          if (state.pending) {
            state.pending = false;
            return run();
          }
          inflight.delete(connectionId);
          return;
        });

    void run();
  }

  const unsubNotification = eventBus.on("ws:notification", (event) => {
    const payload = event.payload;
    if (!isRecord(payload)) return;
    if (payload["kind"] !== "friend-updated") return;
    const connectionId = payload["connectionId"];
    if (typeof connectionId !== "string") return;

    eventBus.emit("friend:data-changed", { type: "friend:data-changed", connectionId });
  });

  const unsubDataChanged = eventBus.on("friend:data-changed", (event) => {
    scheduleIndex(event.connectionId);
  });

  return () => {
    unsubNotification();
    unsubDataChanged();
  };
}
