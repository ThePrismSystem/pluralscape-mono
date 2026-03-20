import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SseEventBuffer } from "../../lib/sse-manager.js";

describe("SseEventBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("assigns monotonically increasing IDs", () => {
    const buffer = new SseEventBuffer();
    const id1 = buffer.push("test", "data1");
    const id2 = buffer.push("test", "data2");
    const id3 = buffer.push("test", "data3");

    expect(Number(id1)).toBeLessThan(Number(id2));
    expect(Number(id2)).toBeLessThan(Number(id3));
  });

  it("push returns the assigned event ID", () => {
    const buffer = new SseEventBuffer();
    const id = buffer.push("notification", '{"msg":"hello"}');

    expect(id).toBe("1");
    expect(buffer.size).toBe(1);
  });

  it("since returns events after the given ID", () => {
    const buffer = new SseEventBuffer();
    buffer.push("a", "data-a");
    buffer.push("b", "data-b");
    buffer.push("c", "data-c");

    const events = buffer.since("1");
    expect(events).toHaveLength(2);
    expect(events?.[0]?.event).toBe("b");
    expect(events?.[1]?.event).toBe("c");
  });

  it("since returns empty array when client is caught up", () => {
    const buffer = new SseEventBuffer();
    buffer.push("a", "data-a");
    const events = buffer.since("1");

    expect(events).toEqual([]);
  });

  it("since returns null for invalid ID format", () => {
    const buffer = new SseEventBuffer();
    buffer.push("a", "data-a");

    expect(buffer.since("not-a-number")).toBeNull();
  });

  it("evicts oldest events when over capacity", () => {
    const buffer = new SseEventBuffer(3);
    buffer.push("a", "1");
    buffer.push("b", "2");
    buffer.push("c", "3");
    buffer.push("d", "4"); // Evicts "a"

    expect(buffer.size).toBe(3);
    // Event "a" (id=1) was evicted — since(1) detects gap since oldest is 2
    // but since(2) should return events 3,4
    const gapResult = buffer.since("0");
    expect(gapResult).toBeNull(); // Gap: 0 < 2 - 1

    const events = buffer.since("1");
    expect(events).toHaveLength(3);
    expect(events?.[0]?.event).toBe("b");
  });

  it("since returns null when target ID is before buffer window (gap)", () => {
    const buffer = new SseEventBuffer(2);
    buffer.push("a", "1"); // id=1
    buffer.push("b", "2"); // id=2
    buffer.push("c", "3"); // id=3, evicts id=1
    buffer.push("d", "4"); // id=4, evicts id=2

    // Client last saw id=1 but buffer only has 3,4 — gap detected
    const result = buffer.since("1");
    expect(result).toBeNull();
  });

  it("filters out events older than maxAgeMs", () => {
    const maxAgeMs = 60_000;
    const buffer = new SseEventBuffer(100, maxAgeMs);

    buffer.push("old", "old-data");
    vi.advanceTimersByTime(maxAgeMs + 1);
    buffer.push("new", "new-data");

    // since("0") should skip the old event
    const events = buffer.since("0");
    expect(events).toHaveLength(1);
    expect(events?.[0]?.event).toBe("new");
  });

  it("currentId returns the next ID to be assigned", () => {
    const buffer = new SseEventBuffer();
    expect(buffer.currentId).toBe(1);
    buffer.push("a", "1");
    expect(buffer.currentId).toBe(2);
  });

  it("since returns all events when lastEventId is 0", () => {
    const buffer = new SseEventBuffer();
    buffer.push("a", "1");
    buffer.push("b", "2");

    const events = buffer.since("0");
    expect(events).toHaveLength(2);
  });
});
