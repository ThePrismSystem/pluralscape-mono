import type { JobQueue } from "@pluralscape/queue";

let queueInstance: JobQueue | null = null;

/**
 * Get the shared JobQueue for the API process.
 * Returns null if no queue has been initialized (e.g., queue backend not configured).
 * Call `setQueue()` during startup to enable queue features.
 */
export function getQueue(): JobQueue | null {
  return queueInstance;
}

/** Set the queue instance (called during app startup). */
export function setQueue(queue: JobQueue): void {
  queueInstance = queue;
}

/** Reset the queue (for testing). */
export function _resetQueueForTesting(): void {
  queueInstance = null;
}
