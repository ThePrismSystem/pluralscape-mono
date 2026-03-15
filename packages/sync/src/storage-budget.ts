import { parseDocumentId } from "./document-types.js";
import { SYNC_PRIORITY_ORDER } from "./types.js";

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

function getEvictionCategory(docId: string): SyncPriorityCategory {
  const parsed = parseDocumentId(docId);
  if (parsed.timePeriod !== null) {
    switch (parsed.documentType) {
      case "fronting":
        return "fronting-historical";
      case "chat":
        return "chat-historical";
      case "journal":
        return "journal-historical";
      default:
        break;
    }
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
  const status = checkStorageBudget(documents, budget);
  if (status.withinBudget) return [];

  const evictable = [...documents.entries()].filter(([docId]) => {
    const parsed = parseDocumentId(docId);
    return parsed.documentType !== "system-core" && parsed.documentType !== "privacy-config";
  });

  // Sort by priority index descending (lowest priority = highest index = evict first)
  evictable.sort((a, b) => {
    const aIdx = SYNC_PRIORITY_ORDER.indexOf(getEvictionCategory(a[0]));
    const bIdx = SYNC_PRIORITY_ORDER.indexOf(getEvictionCategory(b[0]));
    return bIdx - aIdx;
  });

  const candidates: string[] = [];
  let remaining = status.excessBytes;

  for (const [docId, size] of evictable) {
    if (remaining <= 0) break;
    candidates.push(docId);
    remaining -= size;
  }

  return candidates;
}
