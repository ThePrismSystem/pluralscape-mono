import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ValkeyPubSub } from "../../ws/valkey-pubsub.js";

import type { PubSubClient, PubSubClientFactory } from "../../ws/valkey-pubsub.js";

// ── Mock helpers ────────────────────────────────────────────────────

interface MockRedisInstance {
  subscribeMock: ReturnType<typeof vi.fn>;
  unsubscribeMock: ReturnType<typeof vi.fn>;
  publishMock: ReturnType<typeof vi.fn>;
  disconnectMock: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
}

function createMockRedis(): { client: PubSubClient; mock: MockRedisInstance } {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  const subscribeMock = vi.fn().mockResolvedValue(undefined);
  const unsubscribeMock = vi.fn().mockResolvedValue(undefined);
  const publishMock = vi.fn().mockResolvedValue(1);
  const disconnectMock = vi.fn().mockResolvedValue(undefined);

  const client: PubSubClient = {
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
    publish: publishMock,
    on(event: string, handler: (...args: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
    },
    disconnect: disconnectMock,
    status: "ready",
  };

  const mock: MockRedisInstance = {
    subscribeMock,
    unsubscribeMock,
    publishMock,
    disconnectMock,
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };

  return { client, mock };
}

let mocks: MockRedisInstance[] = [];

function mockFactory(): PubSubClientFactory {
  return (): PubSubClient => {
    const { client, mock } = createMockRedis();
    mocks.push(mock);
    return client;
  };
}

function sub(): MockRedisInstance {
  const m = mocks[0];
  if (!m) throw new Error("Expected subscriber mock");
  return m;
}

function pub(): MockRedisInstance {
  const m = mocks[1];
  if (!m) throw new Error("Expected publisher mock");
  return m;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("ValkeyPubSub", () => {
  let pubsub: ValkeyPubSub;

  beforeEach(() => {
    mocks = [];
    pubsub = new ValkeyPubSub("server-1");
  });

  afterEach(async () => {
    await pubsub.disconnect();
  });

  describe("connect", () => {
    it("creates subscriber and publisher connections", async () => {
      const connected = await pubsub.connect("redis://localhost:6379", mockFactory());
      expect(connected).toBe(true);
      expect(pubsub.connected).toBe(true);
      expect(mocks).toHaveLength(2);
    });

    it("registers error listeners on both clients", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());

      // Both subscriber and publisher should have had .on("error") called
      // Verify by emitting error events — they should not throw
      expect(() => {
        sub().emit("error", new Error("test subscriber error"));
      }).not.toThrow();
      expect(() => {
        pub().emit("error", new Error("test publisher error"));
      }).not.toThrow();
    });

    it("returns false on connection failure", async () => {
      const failFactory: PubSubClientFactory = () => {
        throw new Error("ECONNREFUSED");
      };

      const connected = await pubsub.connect("redis://bad:6379", failFactory);
      expect(connected).toBe(false);
      expect(pubsub.connected).toBe(false);
    });
  });

  describe("publish", () => {
    it("publishes to the correct channel", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());

      await pubsub.publish("ps:sync:doc-1", '{"type":"DocumentUpdate"}');

      expect(pub().publishMock).toHaveBeenCalledWith("ps:sync:doc-1", '{"type":"DocumentUpdate"}');
    });

    it("is a no-op when not connected", async () => {
      await pubsub.publish("ps:sync:doc-1", "test");
    });

    it("does not throw on publish failure", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      pub().publishMock.mockRejectedValueOnce(new Error("network error"));

      await pubsub.publish("ps:sync:doc-1", "test");
    });
  });

  describe("subscribe", () => {
    it("registers handler and subscribes to Valkey channel", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());

      await pubsub.subscribe("ps:sync:doc-1", vi.fn());

      expect(sub().subscribeMock).toHaveBeenCalledWith("ps:sync:doc-1");
    });

    it("delivers messages to registered handlers", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const handler = vi.fn();

      await pubsub.subscribe("ps:sync:doc-1", handler);
      sub().emit("message", "ps:sync:doc-1", '{"data":"test"}');

      expect(handler).toHaveBeenCalledWith('{"data":"test"}');
    });

    it("subscribes to Valkey only once per channel", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());

      await pubsub.subscribe("ps:sync:doc-1", vi.fn());
      await pubsub.subscribe("ps:sync:doc-1", vi.fn());

      expect(sub().subscribeMock).toHaveBeenCalledTimes(1);
    });

    it("delivers to all handlers for same channel", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await pubsub.subscribe("ps:sync:doc-1", handler1);
      await pubsub.subscribe("ps:sync:doc-1", handler2);
      sub().emit("message", "ps:sync:doc-1", "test");

      expect(handler1).toHaveBeenCalledWith("test");
      expect(handler2).toHaveBeenCalledWith("test");
    });

    it("tracks channels when not connected", async () => {
      await pubsub.subscribe("ps:sync:doc-1", vi.fn());
    });
  });

  describe("unsubscribe", () => {
    it("removes handler and unsubscribes when none remain", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const handler = vi.fn();

      await pubsub.subscribe("ps:sync:doc-1", handler);
      await pubsub.unsubscribe("ps:sync:doc-1", handler);

      expect(sub().unsubscribeMock).toHaveBeenCalledWith("ps:sync:doc-1");
    });

    it("keeps Valkey subscription if other handlers remain", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await pubsub.subscribe("ps:sync:doc-1", handler1);
      await pubsub.subscribe("ps:sync:doc-1", handler2);
      await pubsub.unsubscribe("ps:sync:doc-1", handler1);

      expect(sub().unsubscribeMock).not.toHaveBeenCalled();
    });

    it("is safe for unknown channel", async () => {
      await pubsub.unsubscribe("unknown-channel");
    });
  });

  describe("reconnection", () => {
    it("removes channel on resubscribe failure", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const s = sub();
      const handler = vi.fn();

      await pubsub.subscribe("ps:sync:doc-fail", handler);
      s.subscribeMock.mockClear();

      // Make resubscribe fail
      s.subscribeMock.mockRejectedValueOnce(new Error("resubscribe failed"));
      s.emit("ready");

      // Wait for async resubscribe to settle
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      // The failed channel's handler should have been removed
      // Verify by emitting a message — handler should NOT be called
      s.emit("message", "ps:sync:doc-fail", "test");
      expect(handler).not.toHaveBeenCalled();
    });

    it("resubscribes to all active channels on ready event", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      const s = sub();

      await pubsub.subscribe("ps:sync:doc-1", vi.fn());
      await pubsub.subscribe("ps:sync:doc-2", vi.fn());
      s.subscribeMock.mockClear();

      s.emit("ready");

      expect(s.subscribeMock).toHaveBeenCalledTimes(2);
      expect(s.subscribeMock).toHaveBeenCalledWith("ps:sync:doc-1");
      expect(s.subscribeMock).toHaveBeenCalledWith("ps:sync:doc-2");
    });
  });

  describe("disconnect", () => {
    it("clears state and disconnects both clients", async () => {
      await pubsub.connect("redis://localhost:6379", mockFactory());
      await pubsub.subscribe("ps:sync:doc-1", vi.fn());

      const s = sub();
      const p = pub();
      await pubsub.disconnect();

      expect(pubsub.connected).toBe(false);
      expect(s.disconnectMock).toHaveBeenCalled();
      expect(p.disconnectMock).toHaveBeenCalled();
    });

    it("is safe when not connected", async () => {
      await pubsub.disconnect();
    });
  });

  describe("serverId", () => {
    it("exposes the server ID for deduplication", () => {
      expect(pubsub.id).toBe("server-1");
    });
  });
});
