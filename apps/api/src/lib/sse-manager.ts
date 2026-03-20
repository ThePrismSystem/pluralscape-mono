/**
 * SSE event buffer with monotonic ID generation and ring buffer eviction.
 *
 * Retains up to SSE_REPLAY_BUFFER_SIZE events for at most SSE_REPLAY_MAX_AGE_MS.
 * Supports replay from a given Last-Event-ID for client reconnection.
 */
import { SSE_REPLAY_BUFFER_SIZE, SSE_REPLAY_MAX_AGE_MS } from "./sse.constants.js";

export interface SseEvent {
  /** Monotonically increasing event ID. */
  readonly id: string;
  /** SSE event type field (e.g. "fronting-status", "notification"). */
  readonly event: string;
  /** JSON-serializable event data. */
  readonly data: string;
  /** Timestamp when the event was buffered. */
  readonly timestamp: number;
}

/**
 * Ring buffer for SSE events supporting replay on reconnect.
 *
 * Thread-safety note: designed for single-threaded JS runtimes.
 * Each account should have its own buffer instance.
 */
export class SseEventBuffer {
  private readonly buffer: SseEvent[] = [];
  private nextId = 1;
  private readonly maxSize: number;
  private readonly maxAgeMs: number;

  constructor(maxSize = SSE_REPLAY_BUFFER_SIZE, maxAgeMs = SSE_REPLAY_MAX_AGE_MS) {
    this.maxSize = maxSize;
    this.maxAgeMs = maxAgeMs;
  }

  /** Push an event into the buffer. Returns the assigned event ID. */
  push(event: string, data: string): string {
    const id = String(this.nextId++);
    const entry: SseEvent = {
      id,
      event,
      data,
      timestamp: Date.now(),
    };

    this.buffer.push(entry);

    // Evict oldest if over capacity
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    return id;
  }

  /**
   * Get all events after the given Last-Event-ID within the replay window.
   * Returns null if the ID is too old (outside the buffer), meaning the
   * client must perform a full sync.
   */
  since(lastEventId: string): SseEvent[] | null {
    const targetId = Number(lastEventId);
    if (!Number.isFinite(targetId) || targetId < 0) return null;

    // Check for gaps first: if targetId is before the oldest buffered event,
    // the client missed events that were evicted from the ring buffer
    if (this.buffer.length > 0) {
      const oldestId = Number(this.buffer[0]?.id);
      if (targetId < oldestId - 1) {
        return null;
      }
    }

    const now = Date.now();
    const minTimestamp = now - this.maxAgeMs;

    // Find the first event after the target ID that's within the age window
    const startIdx = this.buffer.findIndex(
      (e) => Number(e.id) > targetId && e.timestamp >= minTimestamp,
    );

    if (startIdx === -1) {
      // Client is caught up or all remaining events are too old
      return [];
    }

    return this.buffer.slice(startIdx);
  }

  /** Current number of buffered events. */
  get size(): number {
    return this.buffer.length;
  }

  /** The next ID that will be assigned. */
  get currentId(): number {
    return this.nextId;
  }
}
