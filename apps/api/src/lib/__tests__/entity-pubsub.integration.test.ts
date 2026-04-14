import { afterEach, describe, expect, it, vi } from "vitest";

import {
  entityChangeGenerator,
  publishEntityChange,
  subscribeToEntityChanges,
} from "../entity-pubsub.js";
import {
  _resetNotificationPubSubForTesting,
  setNotificationPubSub,
} from "../notification-pubsub.js";

import type { NotificationPubSub } from "../notification-pubsub.js";
import type { EntityChangeEvent } from "@pluralscape/types";

// ---------------------------------------------------------------------------
// In-memory pub/sub mock
// ---------------------------------------------------------------------------

type MessageHandler = (message: string) => void;

interface InMemoryPubSub {
  readonly pubsub: NotificationPubSub;
  readonly publishSpy: ReturnType<typeof vi.fn>;
  readonly unsubscribeSpy: ReturnType<typeof vi.fn>;
  deliver(channel: string, message: string): void;
}

function createInMemoryPubSub(): InMemoryPubSub {
  const handlers = new Map<string, Set<MessageHandler>>();

  const deliver = (channel: string, message: string): void => {
    const set = handlers.get(channel);
    if (!set) return;
    for (const h of set) h(message);
  };

  const publishSpy = vi.fn((channel: string, message: string): Promise<boolean> => {
    deliver(channel, message);
    return Promise.resolve(true);
  });

  const subscribeSpy = vi.fn(
    (channel: string, handler: MessageHandler): Promise<"subscribed" | "deferred" | "failed"> => {
      let set = handlers.get(channel);
      if (!set) {
        set = new Set();
        handlers.set(channel, set);
      }
      set.add(handler);
      return Promise.resolve("subscribed");
    },
  );

  const unsubscribeSpy = vi.fn((channel: string, handler?: MessageHandler): Promise<void> => {
    const set = handlers.get(channel);
    if (!set) return Promise.resolve();
    if (handler) {
      set.delete(handler);
    } else {
      set.clear();
    }
    if (set.size === 0) handlers.delete(channel);
    return Promise.resolve();
  });

  return {
    pubsub: { publish: publishSpy, subscribe: subscribeSpy, unsubscribe: unsubscribeSpy },
    publishSpy,
    unsubscribeSpy,
    deliver,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SYSTEM_ID = "sys_test_001" as Parameters<typeof publishEntityChange>[0];

/** Wait for the generator to reach its event-waiting state. */
function waitForGenerator(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function makeMessageEvent(partial?: Partial<EntityChangeEvent>): EntityChangeEvent {
  return {
    entity: "message",
    type: "created",
    messageId: "msg_001" as never,
    channelId: "ch_001" as never,
    ...partial,
  } as EntityChangeEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("publishEntityChange", () => {
  afterEach(() => {
    _resetNotificationPubSubForTesting();
  });

  it("publishes JSON to the correct channel when pubsub is configured", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const event = makeMessageEvent();
    const result = await publishEntityChange(SYSTEM_ID, event);

    expect(result).toBe(true);
    expect(mock.publishSpy).toHaveBeenCalledWith(
      `entity-change:${SYSTEM_ID}:message`,
      JSON.stringify(event),
    );
  });

  it("returns false when pubsub is not configured", async () => {
    const result = await publishEntityChange(SYSTEM_ID, makeMessageEvent());
    expect(result).toBe(false);
  });
});

describe("subscribeToEntityChanges", () => {
  afterEach(() => {
    _resetNotificationPubSubForTesting();
  });

  it("delivers parsed events to the handler", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const received: EntityChangeEvent[] = [];
    const unsubscribe = await subscribeToEntityChanges(SYSTEM_ID, "message", (evt) => {
      received.push(evt);
    });

    expect(unsubscribe).not.toBeNull();
    if (!unsubscribe) return;

    const event = makeMessageEvent({ type: "updated" });
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(event));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);

    await unsubscribe();
  });

  it("skips malformed JSON and logs an error", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const loggerMock = await import("../logger.js");
    const errorSpy = vi.spyOn(loggerMock.logger, "error").mockImplementation(() => undefined);
    const received: EntityChangeEvent[] = [];

    const unsubscribe = await subscribeToEntityChanges(SYSTEM_ID, "message", (evt) => {
      received.push(evt);
    });

    mock.deliver(`entity-change:${SYSTEM_ID}:message`, "not valid json{{");

    expect(received).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    if (unsubscribe) await unsubscribe();
  });

  it("skips valid JSON with invalid entity type and logs an error", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const loggerMock = await import("../logger.js");
    const errorSpy = vi.spyOn(loggerMock.logger, "error").mockImplementation(() => undefined);
    const received: EntityChangeEvent[] = [];

    const unsubscribe = await subscribeToEntityChanges(SYSTEM_ID, "message", (evt) => {
      received.push(evt);
    });

    // Valid JSON but fails Zod schema — "unknown" is not a valid entity discriminant
    mock.deliver(
      `entity-change:${SYSTEM_ID}:message`,
      JSON.stringify({ entity: "unknown", type: "foo" }),
    );

    expect(received).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    if (unsubscribe) await unsubscribe();
  });

  it("returns null when pubsub is not configured", async () => {
    const result = await subscribeToEntityChanges(SYSTEM_ID, "message", () => undefined);
    expect(result).toBeNull();
  });

  it("calls unsubscribe on the channel when the returned function is called", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const unsubscribe = await subscribeToEntityChanges(SYSTEM_ID, "message", () => undefined);
    expect(unsubscribe).not.toBeNull();
    if (!unsubscribe) throw new Error("unreachable");
    await unsubscribe();

    expect(mock.unsubscribeSpy).toHaveBeenCalledWith(
      `entity-change:${SYSTEM_ID}:message`,
      expect.any(Function) as MessageHandler,
    );
  });
});

describe("entityChangeGenerator", () => {
  afterEach(() => {
    _resetNotificationPubSubForTesting();
  });

  it("yields events received on the channel", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const controller = new AbortController();
    const event = makeMessageEvent();
    const results: EntityChangeEvent[] = [];

    const iteration = (async () => {
      for await (const evt of entityChangeGenerator(SYSTEM_ID, "message", controller.signal)) {
        results.push(evt);
      }
    })();

    await waitForGenerator();
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(event));
    await waitForGenerator();
    controller.abort();

    await iteration;
    expect(results).toContainEqual(event);
  });

  it("respects filter predicate — skips events that do not match", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const controller = new AbortController();
    const kept = makeMessageEvent({ type: "deleted" });
    const skipped = makeMessageEvent({ type: "created" });
    const results: EntityChangeEvent[] = [];

    const iteration = (async () => {
      for await (const evt of entityChangeGenerator(
        SYSTEM_ID,
        "message",
        controller.signal,
        (e) => e.type === "deleted",
      )) {
        results.push(evt);
      }
    })();

    await waitForGenerator();
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(skipped));
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(kept));
    await waitForGenerator();
    controller.abort();

    await iteration;
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(kept);
  });

  it("returns immediately when pubsub is not configured", async () => {
    const controller = new AbortController();
    const results: EntityChangeEvent[] = [];

    for await (const evt of entityChangeGenerator(SYSTEM_ID, "message", controller.signal)) {
      results.push(evt);
    }

    expect(results).toHaveLength(0);
  });

  it("terminates cleanly when the AbortSignal fires after yielding events", async () => {
    const mock = createInMemoryPubSub();
    setNotificationPubSub(mock.pubsub);

    const controller = new AbortController();
    const event1 = makeMessageEvent({ type: "created" });
    const event2 = makeMessageEvent({ type: "updated" });
    const results: EntityChangeEvent[] = [];

    const iteration = (async () => {
      for await (const evt of entityChangeGenerator(SYSTEM_ID, "message", controller.signal)) {
        results.push(evt);
      }
    })();

    await waitForGenerator();
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(event1));
    mock.deliver(`entity-change:${SYSTEM_ID}:message`, JSON.stringify(event2));
    await waitForGenerator();
    controller.abort();

    await iteration;
    expect(results).toEqual([event1, event2]);
    expect(mock.unsubscribeSpy).toHaveBeenCalled();
  });

  it("returns immediately when pubsub is unavailable and no signal is provided", async () => {
    const results: EntityChangeEvent[] = [];
    for await (const evt of entityChangeGenerator(SYSTEM_ID, "message", undefined)) {
      results.push(evt);
    }
    expect(results).toHaveLength(0);
  });
});
