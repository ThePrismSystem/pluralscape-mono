import * as Automerge from "@automerge/automerge";

import { DEFAULT_COMPACTION_CONFIG } from "./types.js";

import type { CompactionCheck, CompactionConfig } from "./types.js";

/**
 * Checks whether a document is eligible for compaction (snapshotting).
 * Returns a result indicating eligibility and the reason.
 */
export function checkCompactionEligibility(
  changesSinceSnapshot: number,
  currentSizeBytes: number,
  config: CompactionConfig = DEFAULT_COMPACTION_CONFIG,
  explicit = false,
): CompactionCheck {
  if (explicit) {
    return { eligible: true, reason: "explicit", changesSinceSnapshot, currentSizeBytes };
  }
  if (changesSinceSnapshot >= config.changeThreshold) {
    return { eligible: true, reason: "change-threshold", changesSinceSnapshot, currentSizeBytes };
  }
  if (currentSizeBytes >= config.sizeThresholdBytes) {
    return { eligible: true, reason: "size-threshold", changesSinceSnapshot, currentSizeBytes };
  }
  return { eligible: false, reason: "not-eligible", changesSinceSnapshot, currentSizeBytes };
}

/**
 * Lazily tracks Automerge document size, remeasuring only every N changes.
 * Avoids the cost of `Automerge.save(doc).byteLength` on every change.
 */
const DEFAULT_REMEASURE_INTERVAL = 10;

export class LazyDocumentSizeTracker<T> {
  private cachedSize: number;
  private changesSinceRemeasure: number;
  private readonly remeasureInterval: number;

  constructor(doc: Automerge.Doc<T>, remeasureInterval = DEFAULT_REMEASURE_INTERVAL) {
    this.remeasureInterval = remeasureInterval;
    this.changesSinceRemeasure = 0;
    this.cachedSize = Automerge.save(doc).byteLength;
  }

  get sizeBytes(): number {
    return this.cachedSize;
  }

  /** Call after each change. Remeasures the doc size every `remeasureInterval` calls. */
  increment(doc: Automerge.Doc<T>): void {
    this.changesSinceRemeasure++;
    if (this.changesSinceRemeasure >= this.remeasureInterval) {
      this.cachedSize = Automerge.save(doc).byteLength;
      this.changesSinceRemeasure = 0;
    }
  }

  /** Resets the tracker with a new doc (e.g. after compaction). */
  reset(doc: Automerge.Doc<T>): void {
    this.changesSinceRemeasure = 0;
    this.cachedSize = Automerge.save(doc).byteLength;
  }
}
