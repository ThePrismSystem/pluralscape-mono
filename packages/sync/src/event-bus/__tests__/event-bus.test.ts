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
    const bus = createEventBus<TestEventMap>({ onError: () => {} });
    const good = vi.fn();

    bus.on("test:alpha", () => {
      throw new Error("boom");
    });
    bus.on("test:alpha", good);
    bus.emit("test:alpha", { type: "test:alpha", value: 5 });

    expect(good).toHaveBeenCalledOnce();
  });

  it("calls onError when a listener throws", () => {
    const onError = vi.fn();
    const bus = createEventBus<TestEventMap>({ onError });

    bus.on("test:alpha", () => {
      throw new Error("listener boom");
    });
    bus.emit("test:alpha", { type: "test:alpha", value: 1 });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rethrows asynchronously when no onError provided", () => {
    const bus = createEventBus<TestEventMap>();
    const thrown: unknown[] = [];

    // Capture the async rethrow via queueMicrotask
    const original = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (fn) => {
      try {
        fn();
      } catch (e: unknown) {
        thrown.push(e);
      }
    };

    bus.on("test:alpha", () => {
      throw new Error("async boom");
    });
    bus.emit("test:alpha", { type: "test:alpha", value: 1 });

    expect(thrown).toHaveLength(1);
    expect(thrown[0]).toBeInstanceOf(Error);

    globalThis.queueMicrotask = original;
  });

  it("emit with zero subscribers is a no-op", () => {
    const bus = createEventBus<TestEventMap>();
    expect(() => {
      bus.emit("test:alpha", { type: "test:alpha", value: 0 });
    }).not.toThrow();
  });

  it("unsubscribe-during-iteration does not break dispatch to other listeners", () => {
    const bus = createEventBus<TestEventMap>();
    const captured: number[] = [];

    // Listener A unsubscribes itself during emit.
    const unsubA = bus.on("test:alpha", (event) => {
      captured.push(event.value);
      unsubA();
    });
    // Listener B runs before or after A; both must still fire once.
    bus.on("test:alpha", (event) => {
      captured.push(event.value * 10);
    });

    bus.emit("test:alpha", { type: "test:alpha", value: 1 });

    // Both listeners fired on the first emit.
    expect(captured).toEqual(expect.arrayContaining([1, 10]));
    expect(captured).toHaveLength(2);

    // A is now removed; second emit only dispatches to B.
    captured.length = 0;
    bus.emit("test:alpha", { type: "test:alpha", value: 2 });
    expect(captured).toEqual([20]);
  });

  it("unsubscribing the last listener deletes the event type's bucket", () => {
    const bus = createEventBus<TestEventMap>();
    const listener = vi.fn();
    const unsub = bus.on("test:alpha", listener);

    // First unsubscribe removes the only listener and the bucket.
    unsub();

    // Subsequent emit finds no bucket and returns early.
    bus.emit("test:alpha", { type: "test:alpha", value: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("calling unsubscribe twice is idempotent", () => {
    const bus = createEventBus<TestEventMap>();
    const listener = vi.fn();
    const unsub = bus.on("test:alpha", listener);

    unsub();
    expect(() => {
      unsub();
    }).not.toThrow();

    bus.emit("test:alpha", { type: "test:alpha", value: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("removeAll is a no-op when no listeners are registered", () => {
    const bus = createEventBus<TestEventMap>();
    expect(() => {
      bus.removeAll();
    }).not.toThrow();
  });
});

describe("event-bus public re-exports", () => {
  it("createEventBus is re-exported from the package barrel", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.createEventBus).toBe("function");
    const bus = mod.createEventBus<TestEventMap>();
    const listener = vi.fn();
    bus.on("test:alpha", listener);
    bus.emit("test:alpha", { type: "test:alpha", value: 1 });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("event-map types are tagged with literal discriminants", async () => {
    // Event-map contains only type declarations; exercise them indirectly
    // by constructing values that satisfy the type at the surface.
    const eventBus = (await import("../index.js")).createEventBus<
      import("../event-map.js").DataLayerEventMap
    >();
    const received: string[] = [];
    eventBus.on("sync:error", (event) => {
      received.push(event.type);
    });
    eventBus.emit("sync:error", {
      type: "sync:error",
      message: "test",
      error: new Error("x"),
    });
    expect(received).toEqual(["sync:error"]);
  });
});
