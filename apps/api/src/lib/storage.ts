import { createQuotaService } from "@pluralscape/storage/quota";

import { BlobUsageQueryImpl } from "./blob-usage-query.js";

import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { BlobQuotaService } from "@pluralscape/storage/quota";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

let cachedAdapter: BlobStorageAdapter | null = null;

/**
 * Get the shared blob storage adapter.
 * Must be initialized via setStorageAdapterForTesting() in tests
 * or via initStorageAdapter() at app startup.
 */
export function getStorageAdapter(): BlobStorageAdapter {
  if (!cachedAdapter) {
    throw new Error("Storage adapter not initialized — call initStorageAdapter() at startup");
  }
  return cachedAdapter;
}

/** Initialize the storage adapter (called at app startup). */
export function initStorageAdapter(adapter: BlobStorageAdapter): void {
  cachedAdapter = adapter;
}

/** Set the storage adapter directly (for testing). */
export function setStorageAdapterForTesting(adapter: BlobStorageAdapter): void {
  cachedAdapter = adapter;
}

/** Reset the storage adapter cache (for testing). */
export function _resetStorageAdapterForTesting(): void {
  cachedAdapter = null;
}

/** Create a BlobQuotaService using the given DB connection. */
export function getQuotaService(db: PostgresJsDatabase): BlobQuotaService {
  const usageQuery = new BlobUsageQueryImpl(db);
  return createQuotaService(usageQuery);
}
