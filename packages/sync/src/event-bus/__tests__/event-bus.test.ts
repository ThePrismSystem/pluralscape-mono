import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../event-bus.js";

interface TestEventMap {
  "test:alpha": { readonly type: "test:alpha"; readonly value: number };
  "test:beta": { readonly type: "test:beta"; readonly label: string };
}

describe("createEventBus", () => {
  it("delivers events to subscribers", () => {
    const bus = createEventBus<TestEventMap>();
    const listener = vi.fn();

    bus.on("test:alpha", listener);
    bus.emit("test:alpha", { type: "test:alpha", value: 42 });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ type: "test:alpha", value: 42 });
  });

  it("does not deliver events to unsubscribed listeners", () => {
    const bus = createEventBus<TestEventMap>();
    const listener = vi.fn();

    const unsub = bus.on("test:alpha", listener);
    unsub();
    bus.emit("test:alpha", { type: "test:alpha", value: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple listeners for the same event", () => {
    const bus = createEventBus<TestEventMap>();
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    bus.on("test:alpha", listenerA);
    bus.on("test:alpha", listenerB);
    bus.emit("test:alpha", { type: "test:alpha", value: 7 });

    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerB).toHaveBeenCalledOnce();
  });

  it("isolates events by type", () => {
    const bus = createEventBus<TestEventMap>();
    const alphaListener = vi.fn();
    const betaListener = vi.fn();

    bus.on("test:alpha", alphaListener);
    bus.on("test:beta", betaListener);
    bus.emit("test:alpha", { type: "test:alpha", value: 99 });

    expect(alphaListener).toHaveBeenCalledOnce();
    expect(betaListener).not.toHaveBeenCalled();
  });

  it("passes typed payloads correctly", () => {
    const bus = createEventBus<TestEventMap>();
    const received: Array<{ type: "test:beta"; label: string }> = [];

    bus.on("test:beta", (event) => {
      received.push(event);
    });
    bus.emit("test:beta", { type: "test:beta", label: "hello" });

    expect(received).toHaveLength(1);
    expect(received[0]?.label).toBe("hello");
  });

  it("removeAll clears all listeners", () => {
    const bus = createEventBus<TestEventMap>();
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    bus.on("test:alpha", listenerA);
    bus.on("test:beta", listenerB);
    bus.removeAll();
    bus.emit("test:alpha", { type: "test:alpha", value: 0 });
    bus.emit("test:beta", { type: "test:beta", label: "gone" });

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();
  });

  it("listener throwing does not break other listeners", () => {
    const bus = createEventBus<TestEventMap>();
    const good = vi.fn();

    bus.on("test:alpha", () => {
      throw new Error("boom");
    });
    bus.on("test:alpha", good);
    bus.emit("test:alpha", { type: "test:alpha", value: 5 });

    expect(good).toHaveBeenCalledOnce();
  });
});
