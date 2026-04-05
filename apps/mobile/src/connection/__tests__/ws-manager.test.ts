import { createEventBus } from "@pluralscape/sync";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWsManager } from "../ws-manager.js";

import type { WsManager } from "../ws-manager.js";
import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

function asSystemId(id: string): SystemId {
  return id as SystemId;
}

// ── Mock createWsClientAdapter ──────────────────────────────────────

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("@pluralscape/sync/adapters", async (importOriginal) => {
  const original = await importOriginal<typeof import("@pluralscape/sync/adapters")>();
  return {
    ...original,
    createWsClientAdapter: vi.fn(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      close: mockDisconnect,
      submitChange: vi.fn(),
      fetchChangesSince: vi.fn(),
      submitSnapshot: vi.fn(),
      fetchLatestSnapshot: vi.fn(),
      subscribe: vi.fn(),
      fetchManifest: vi.fn(),
    })),
  };
});

// ── Helpers ─────────────────────────────────────────────────────────

function makeManager(eventBus: EventBus<DataLayerEventMap>): WsManager {
  return createWsManager({
    url: "wss://example.com/sync",
    eventBus,
    baseBackoffMs: 100,
    maxBackoffMs: 1_000,
  });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WsManager", () => {
  describe("connect", () => {
    it("sets status to connecting when connect() is called", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      expect(manager.getSnapshot()).toBe("connecting");
    });

    it("creates a WsClientAdapter with the given token and systemId", async () => {
      const { createWsClientAdapter } = await import("@pluralscape/sync/adapters");
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("my-token", asSystemId("sys_xyz"));

      expect(createWsClientAdapter).toHaveBeenCalledWith(
        expect.objectContaining({ token: "my-token", systemId: "sys_xyz" }),
      );
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect", () => {
    it("sets status to disconnected when disconnect() is called", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      manager.disconnect();

      expect(manager.getSnapshot()).toBe("disconnected");
    });

    it("calls disconnect on the adapter", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      manager.disconnect();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe / getSnapshot", () => {
    it("getSnapshot returns the current status", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      expect(manager.getSnapshot()).toBe("disconnected");
      manager.connect("tok", asSystemId("sys_abc"));
      expect(manager.getSnapshot()).toBe("connecting");
    });

    it("notifies subscribe listeners when status changes", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.connect("tok", asSystemId("sys_abc"));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops notifications", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();

      manager.connect("tok", asSystemId("sys_abc"));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("event bus integration", () => {
    it("transitions to connected when ws:connected event is emitted", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      expect(manager.getSnapshot()).toBe("connecting");

      eventBus.emit("ws:connected", { type: "ws:connected" });
      expect(manager.getSnapshot()).toBe("connected");
    });

    it("resets retry count and stays connected on ws:connected", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      const listener = vi.fn();

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });

      manager.subscribe(listener);
      // Emitting ws:connected again (reconnect scenario) should remain connected
      eventBus.emit("ws:connected", { type: "ws:connected" });
      // No status change — listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });

    it("transitions through backoff when ws:disconnected fires while connected", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });
      expect(manager.getSnapshot()).toBe("connected");

      eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "network" });
      expect(manager.getSnapshot()).toBe("backoff");

      vi.advanceTimersByTime(200); // past baseBackoffMs * jitter max (100 * 1.25)
      expect(manager.getSnapshot()).toBe("reconnecting");

      vi.useRealTimers();
    });

    it("reconnects after backoff completes", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });

      eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "network" });
      expect(manager.getSnapshot()).toBe("backoff");

      // Advance past backoff, new adapter created and connect called again
      vi.advanceTimersByTime(200);
      expect(manager.getSnapshot()).toBe("reconnecting");
      expect(mockConnect).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("transitions to connected after successful reconnect", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });

      eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "network" });
      vi.advanceTimersByTime(200);

      eventBus.emit("ws:connected", { type: "ws:connected" });
      expect(manager.getSnapshot()).toBe("connected");

      vi.useRealTimers();
    });

    it("caps backoff delay at maxBackoffMs", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });

      // Trigger many disconnects to increase retry count
      for (let i = 0; i < 10; i++) {
        eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "network" });
        vi.advanceTimersByTime(2_000); // past maxBackoffMs (1000) * jitter max
        eventBus.emit("ws:connected", { type: "ws:connected" });
      }

      // After 10 retries, all should have reconnected (backoff capped at 1000ms)
      // initial connect + 10 reconnects = 11
      expect(mockConnect).toHaveBeenCalledTimes(11);

      vi.useRealTimers();
    });
  });

  describe("getAdapter", () => {
    it("returns null before connect", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      expect(manager.getAdapter()).toBeNull();
    });

    it("returns the adapter after connect", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      manager.connect("token", asSystemId("sys_123"));
      expect(manager.getAdapter()).not.toBeNull();
    });

    it("returns null after disconnect", () => {
      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);
      manager.connect("token", asSystemId("sys_123"));
      manager.disconnect();
      expect(manager.getAdapter()).toBeNull();
    });
  });

  describe("intentional disconnect", () => {
    it("does not trigger reconnect when disconnected intentionally", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });
      expect(manager.getSnapshot()).toBe("connected");

      manager.disconnect();
      expect(manager.getSnapshot()).toBe("disconnected");

      // Even if the adapter fires ws:disconnected after our explicit close
      eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "client disconnected" });
      expect(manager.getSnapshot()).toBe("disconnected");

      vi.advanceTimersByTime(10_000);
      expect(manager.getSnapshot()).toBe("disconnected");
      // Should not have called connect again
      expect(mockConnect).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("clears pending backoff timer when disconnect is called during backoff", () => {
      vi.useFakeTimers();

      const eventBus = createEventBus<DataLayerEventMap>();
      const manager = makeManager(eventBus);

      manager.connect("tok", asSystemId("sys_abc"));
      eventBus.emit("ws:connected", { type: "ws:connected" });

      eventBus.emit("ws:disconnected", { type: "ws:disconnected", reason: "network" });
      expect(manager.getSnapshot()).toBe("backoff");

      manager.disconnect();
      expect(manager.getSnapshot()).toBe("disconnected");

      // Advance past backoff — should NOT reconnect
      vi.advanceTimersByTime(10_000);
      expect(manager.getSnapshot()).toBe("disconnected");
      expect(mockConnect).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
