import { ENTITY_TABLE_REGISTRY, entityToRow } from "@pluralscape/sync/materializer";

import type { DataLayerEventMap, EventBus, SyncedEntityType } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";

// ── Friend-exportable entity types ────────────────────────────────────

/**
 * The set of entity types whose data is shared with friends.
 * Mirrors FRIEND_EXPORTABLE_ENTITY_TYPES in local-schema.ts.
 */
const FRIEND_EXPORTABLE_ENTITY_TYPES = new Set<SyncedEntityType>([
  "member",
  "group",
  "channel",
  "message",
  "note",
  "poll",
  "relationship",
  "structure-entity-type",
  "structure-entity",
  "journal-entry",
  "wiki-page",
  "custom-front",
  "fronting-session",
  "board-message",
  "acknowledgement",
  "innerworld-entity",
  "innerworld-region",
  "field-definition",
  "field-value",
  "member-photo",
  "fronting-comment",
]);

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
    const tableDef = ENTITY_TABLE_REGISTRY[entityType];
    db.execute(`DELETE FROM friend_${tableDef.tableName} WHERE connection_id = ?`, [connectionId]);
  }

  // 2. Fetch all pages and insert decrypted entities.
  let cursor: string | undefined;
  do {
    const page: FriendExportPage = await fetchExport(connectionId, cursor);

    for (const entity of page.data) {
      if (!isFriendExportableEntityType(entity.entityType)) continue;

      const tableDef = ENTITY_TABLE_REGISTRY[entity.entityType];
      const friendTableName = `friend_${tableDef.tableName}`;
      const decrypted = decryptEntity(entity.encryptedData, entity.entityType);

      // Build the row from the decrypted entity (without connection_id first).
      const columnNames = tableDef.columns.map((c: { name: string }) => c.name);
      const row = entityToRow(entity.id, decrypted, columnNames);

      // Prepend connection_id to columns and params.
      const presentColumns = ["connection_id", ...columnNames.filter((col: string) => col in row)];
      const placeholders = presentColumns.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${friendTableName} (${presentColumns.join(", ")}) VALUES (${placeholders})`;
      const params: unknown[] = [
        connectionId,
        ...columnNames.filter((col: string) => col in row).map((col: string) => row[col] ?? null),
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

  const unsubNotification = eventBus.on("ws:notification", (event) => {
    const payload = event.payload;
    if (!isRecord(payload)) return;
    if (payload["kind"] !== "friend-updated") return;
    const connectionId = payload["connectionId"];
    if (typeof connectionId !== "string") return;

    eventBus.emit("friend:data-changed", { type: "friend:data-changed", connectionId });
  });

  const unsubDataChanged = eventBus.on("friend:data-changed", (event) => {
    void indexFriend(event.connectionId, config).catch((err: unknown) => {
      eventBus.emit("sync:error", {
        type: "sync:error",
        message: `Failed to index friend data for connection ${event.connectionId}`,
        error: err,
      });
    });
  });

  return () => {
    unsubNotification();
    unsubDataChanged();
  };
}
