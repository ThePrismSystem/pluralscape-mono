/**
 * SSE event buffer with monotonic ID generation and ring buffer eviction.
 *
 * Retains up to SSE_REPLAY_BUFFER_SIZE events for at most SSE_REPLAY_MAX_AGE_MS.
 * Supports replay from a given Last-Event-ID for client reconnection.
 */
import { SSE_REPLAY_BUFFER_SIZE, SSE_REPLAY_MAX_AGE_MS } from "./sse.constants.js";

import type { UnixMillis } from "@pluralscape/types";

export interface SseEvent {
  /** Monotonically increasing event ID. */
  readonly id: string;
  /** SSE event type field (e.g. "fronting-status", "notification"). */
  readonly event: string;
  /** JSON-serializable event data. */
  readonly data: string;
  /** Timestamp when the event was buffered. */
  readonly timestamp: UnixMillis;
}

/**
 * Ring buffer for SSE events supporting replay on reconnect.
 *
 * Uses head/tail indices for O(1) push and eviction.
 * Thread-safety note: designed for single-threaded JS runtimes.
 * Each account should have its own buffer instance.
 *
 * The monotonic event counter (`nextId`) resets to 1 on server restart.
 * Clients detect this via Last-Event-ID: if the client's ID >= the server's
 * nextId, the server was restarted and a `full-sync` event is sent instead
 * of attempting replay.
 */
export class SseEventBuffer {
  private readonly ring: (SseEvent | null)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private nextId = 1;
  private readonly maxSize: number;
  private readonly maxAgeMs: number;

  constructor(maxSize = SSE_REPLAY_BUFFER_SIZE, maxAgeMs = SSE_REPLAY_MAX_AGE_MS) {
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
    this.ring = new Array<SseEvent | null>(maxSize).fill(null);
  }

  /** Push an event into the buffer. Returns the assigned event ID. */
  push(event: string, data: string): string {
    const id = String(this.nextId++);
    const entry: SseEvent = {
      id,
      event,
      data,
      timestamp: Date.now() as UnixMillis,
    };

    this.ring[this.tail] = entry;
    this.tail = (this.tail + 1) % this.maxSize;

    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // Buffer full — advance head (evicts oldest)
      this.head = (this.head + 1) % this.maxSize;
    }

    return id;
  }

  /**
   * Get all events after the given Last-Event-ID within the replay window.
   * Returns null if:
   * - The ID is too old (outside the buffer) — client missed evicted events
   * - The target ID >= nextId — client has IDs from a previous server instance (restart)
   * - Events between targetId and first available result were aged out (gap)
   */
  since(lastEventId: string): SseEvent[] | null {
    const targetId = Number(lastEventId);
    if (!Number.isFinite(targetId) || targetId < 0) return null;

    // Restart detection: client has IDs from a previous server instance
    if (targetId >= this.nextId) return null;

    if (this.count === 0) {
      // Empty buffer — if client expects events after targetId, check if any were assigned
      return targetId < this.nextId ? [] : null;
    }

    // Check for eviction gap: if targetId is before the oldest buffered event
    const oldest = this.ring[this.head];
    if (oldest) {
      const oldestId = Number(oldest.id);
      if (targetId < oldestId - 1) {
        return null;
      }
    }

    const now = Date.now();
    const minTimestamp = now - this.maxAgeMs;
    const result: SseEvent[] = [];
    let foundGap = false;

    for (const event of this.events()) {
      const eventId = Number(event.id);
      if (eventId <= targetId) continue;

      if (event.timestamp < minTimestamp) {
        // This event is aged out — mark as a gap between targetId and fresh events
        foundGap = true;
        continue;
      }

      result.push(event);
    }

    // If we skipped aged-out events between targetId and the first fresh result, signal a gap
    if (foundGap && result.length > 0) {
      return null;
    }

    return result;
  }

  /** Current number of buffered events. */
  get size(): number {
    return this.count;
  }

  /** The next ID that will be assigned. */
  get currentId(): number {
    return this.nextId;
  }

  /** The last actually-assigned ID (0 if no events pushed). */
  get lastAssignedId(): number {
    return Math.max(0, this.nextId - 1);
  }

  /** Iterate over all events in order from oldest to newest. */
  private *events(): Generator<SseEvent> {
    for (let i = 0; i < this.count; i++) {
      const event = this.ring[(this.head + i) % this.maxSize];
      if (event) yield event;
    }
  }
}
