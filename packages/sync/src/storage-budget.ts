import { parseDocumentId } from "./document-types.js";
import { SYNC_PRIORITY_ORDER } from "./types.js";

import type { SyncDocumentType } from "./document-types.js";
import type { StorageBudget, SyncPriorityCategory } from "./types.js";

/** Result of checking a set of documents against a storage budget. */
export interface StorageBudgetStatus {
  readonly withinBudget: boolean;
  readonly usedBytes: number;
  readonly maxBytes: number;
  readonly excessBytes: number;
}

/** Checks whether the total size of all documents is within the storage budget. */
export function checkStorageBudget(
  documents: ReadonlyMap<string, number>,
  budget: StorageBudget,
): StorageBudgetStatus {
  let usedBytes = 0;
  for (const size of documents.values()) {
    usedBytes += size;
  }
  const maxBytes = budget.maxTotalBytes;
  const excessBytes = Math.max(0, usedBytes - maxBytes);
  return { withinBudget: usedBytes <= maxBytes, usedBytes, maxBytes, excessBytes };
}

const HISTORICAL_CATEGORY: Partial<Record<SyncDocumentType, SyncPriorityCategory>> = {
  fronting: "fronting-historical",
  chat: "chat-historical",
  journal: "journal-historical",
};

function getEvictionCategory(docId: string): SyncPriorityCategory {
  const parsed = parseDocumentId(docId);
  if (parsed.timePeriod !== null) {
    const historical = HISTORICAL_CATEGORY[parsed.documentType];
    if (historical) return historical;
  }
  return parsed.documentType;
}

/**
 * Selects documents to evict to bring storage within budget.
 * Never evicts system-core or privacy-config documents.
 * Evicts lowest-priority (historical) documents first.
 */
export function selectEvictionCandidates(
  documents: ReadonlyMap<string, number>,
  budget: StorageBudget,
): string[] {
  return selectFromSortedEvictable(buildSortedEvictable(documents), documents, budget);
}

/** Filter and sort evictable doc IDs by descending priority index. */
function buildSortedEvictable(
  documents: ReadonlyMap<string, number>,
  onParseWarning?: (docId: string) => void,
): string[] {
  const evictable = [...documents.keys()].filter((docId) => {
    try {
      const parsed = parseDocumentId(docId);
      return parsed.documentType !== "system-core" && parsed.documentType !== "privacy-config";
    } catch {
      onParseWarning?.(docId);
      return false;
    }
  });

  // Sort by priority index descending (lowest priority = highest index = evict first)
  evictable.sort((a, b) => {
    const aIdx = SYNC_PRIORITY_ORDER.indexOf(getEvictionCategory(a));
    const bIdx = SYNC_PRIORITY_ORDER.indexOf(getEvictionCategory(b));
    return bIdx - aIdx;
  });

  return evictable;
}

/** Pick candidates from pre-sorted evictable list until excess is covered. */
function selectFromSortedEvictable(
  evictable: readonly string[],
  documents: ReadonlyMap<string, number>,
  budget: StorageBudget,
): string[] {
  const status = checkStorageBudget(documents, budget);
  if (status.withinBudget) return [];

  const candidates: string[] = [];
  let remaining = status.excessBytes;

  for (const docId of evictable) {
    if (remaining <= 0) break;
    candidates.push(docId);
    remaining -= documents.get(docId) ?? 0;
  }

  return candidates;
}

/**
 * Caches the sorted eviction candidate list between calls.
 *
 * Only re-sorts when explicitly invalidated (call {@link invalidate} on
 * document add/remove). Consecutive calls with the same document set
 * reuse the cached sort order, avoiding redundant O(n log n) sorts.
 */
export class EvictionCache {
  private cachedEvictable: string[] | null = null;
  private readonly onParseWarning?: (docId: string) => void;

  constructor(options?: { onParseWarning?: (docId: string) => void }) {
    this.onParseWarning = options?.onParseWarning;
  }

  /** Select eviction candidates, reusing cached sort order when valid. */
  selectEvictionCandidates(
    documents: ReadonlyMap<string, number>,
    budget: StorageBudget,
  ): string[] {
    this.cachedEvictable ??= buildSortedEvictable(documents, this.onParseWarning);
    return selectFromSortedEvictable(this.cachedEvictable, documents, budget);
  }

  /** Invalidate the cache. Must be called when documents are added or removed. */
  invalidate(): void {
    this.cachedEvictable = null;
  }
}
