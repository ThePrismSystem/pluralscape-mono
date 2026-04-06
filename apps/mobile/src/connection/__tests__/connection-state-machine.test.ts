import { describe, expect, it, vi } from "vitest";

import { ConnectionStateMachine } from "../connection-state-machine.js";

import type { ConnectionState } from "../connection-types.js";
import type { SystemId } from "@pluralscape/types";

function makeMachine(): ConnectionStateMachine {
  return new ConnectionStateMachine({ baseUrl: "https://example.com" });
}

describe("ConnectionStateMachine", () => {
  it("starts in disconnected state", () => {
    const machine = makeMachine();
    expect(machine.getSnapshot()).toBe("disconnected");
  });

  it("CONNECT from disconnected transitions to connecting", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    expect(machine.getSnapshot()).toBe("connecting");
  });

  it("CONNECTED from connecting transitions to connected", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTED" });
    expect(machine.getSnapshot()).toBe("connected");
  });

  it("CONNECTION_LOST from connected transitions to reconnecting", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTED" });
    machine.dispatch({ type: "CONNECTION_LOST" });
    expect(machine.getSnapshot()).toBe("reconnecting");
  });

  it("DISCONNECT from connected transitions to disconnected", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTED" });
    machine.dispatch({ type: "DISCONNECT" });
    expect(machine.getSnapshot()).toBe("disconnected");
  });

  it("DISCONNECT from connecting transitions to disconnected", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "DISCONNECT" });
    expect(machine.getSnapshot()).toBe("disconnected");
  });

  it("DISCONNECT from reconnecting transitions to disconnected", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTED" });
    machine.dispatch({ type: "CONNECTION_LOST" });
    machine.dispatch({ type: "DISCONNECT" });
    expect(machine.getSnapshot()).toBe("disconnected");
  });

  it("CONNECTION_LOST from connecting transitions to backoff", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTION_LOST" });
    expect(machine.getSnapshot()).toBe("backoff");
  });

  it("BACKOFF_COMPLETE from backoff transitions to reconnecting", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTION_LOST" });
    machine.dispatch({ type: "BACKOFF_COMPLETE" });
    expect(machine.getSnapshot()).toBe("reconnecting");
  });

  it("RETRY from reconnecting transitions to connecting", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTED" });
    machine.dispatch({ type: "CONNECTION_LOST" });
    machine.dispatch({ type: "RETRY" });
    expect(machine.getSnapshot()).toBe("connecting");
  });

  it("computes exponential backoff with base defaults", () => {
    const machine = new ConnectionStateMachine({
      baseUrl: "https://example.com",
      baseBackoffMs: 1_000,
      maxBackoffMs: 30_000,
    });
    // retryCount = 0 initially → first backoff after first loss
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTION_LOST" }); // retryCount = 1
    // 1000 * 2^1 = 2000, jitter ±25% → [1500, 2500]
    const delay = machine.getBackoffMs();
    expect(delay).toBeGreaterThanOrEqual(1_500);
    expect(delay).toBeLessThanOrEqual(2_500);
  });

  it("caps backoff at maxBackoffMs", () => {
    const machine = new ConnectionStateMachine({
      baseUrl: "https://example.com",
      baseBackoffMs: 1_000,
      maxBackoffMs: 5_000,
    });
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    // Trigger multiple failures
    for (let i = 0; i < 10; i++) {
      if (machine.getSnapshot() === "connecting" || machine.getSnapshot() === "reconnecting") {
        machine.dispatch({ type: "CONNECTION_LOST" });
      }
      if (machine.getSnapshot() === "backoff") {
        machine.dispatch({ type: "BACKOFF_COMPLETE" });
      }
      if (machine.getSnapshot() === "reconnecting") {
        machine.dispatch({ type: "RETRY" });
      }
    }
    // cap is 5000, jitter can add up to 25% → max possible is Math.round(5000 * 1.25)
    expect(machine.getBackoffMs()).toBeLessThanOrEqual(Math.round(5_000 * 1.25));
  });

  it("resets retry count on successful connection", () => {
    const machine = new ConnectionStateMachine({
      baseUrl: "https://example.com",
      baseBackoffMs: 1_000,
      maxBackoffMs: 30_000,
    });
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTION_LOST" }); // retryCount = 1
    machine.dispatch({ type: "BACKOFF_COMPLETE" });
    machine.dispatch({ type: "RETRY" });
    machine.dispatch({ type: "CONNECTED" }); // resets retryCount
    // 1000 * 2^0 = 1000, jitter ±25% → [750, 1250]
    const delay = machine.getBackoffMs();
    expect(delay).toBeGreaterThanOrEqual(750);
    expect(delay).toBeLessThanOrEqual(1_250);
  });

  it("notifies listeners on state change", () => {
    const machine = makeMachine();
    const listener = vi.fn();
    machine.subscribe(listener);
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    expect(listener).toHaveBeenCalledOnce();
    const firstCall = listener.mock.calls[0] as [ConnectionState];
    expect(firstCall[0]).toBe("connecting");
  });

  it("notifies multiple listeners", () => {
    const machine = makeMachine();
    const l1 = vi.fn();
    const l2 = vi.fn();
    machine.subscribe(l1);
    machine.subscribe(l2);
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });

  it("unsubscribe stops notifications", () => {
    const machine = makeMachine();
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);
    unsubscribe();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    expect(listener).not.toHaveBeenCalled();
  });

  it("snapshot is referentially stable when no state change occurs", () => {
    const machine = makeMachine();
    const s1 = machine.getSnapshot();
    const s2 = machine.getSnapshot();
    expect(s1).toBe(s2);
  });

  it("snapshot changes after dispatch", () => {
    const machine = makeMachine();
    const before = machine.getSnapshot();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    const after = machine.getSnapshot();
    expect(after).not.toBe(before);
  });

  it("CONNECT is ignored when already connecting", () => {
    const machine = makeMachine();
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    const snapshot = machine.getSnapshot();
    machine.dispatch({ type: "CONNECT", token: "tok2", systemId: "sys" as SystemId });
    expect(machine.getSnapshot()).toBe(snapshot);
  });
});

describe("ConnectionStateMachine.getBackoffMs jitter", () => {
  const JITTER_MIN = 0.75;
  const JITTER_MAX = 1.25;
  const SAMPLE_COUNT = 100;

  it("returns values within jittered range for retry 0", () => {
    const machine = new ConnectionStateMachine({ baseUrl: "http://test" });
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const delay = machine.getBackoffMs();
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });

  it("produces non-deterministic values", () => {
    const machine = new ConnectionStateMachine({ baseUrl: "http://test" });
    const values = new Set<number>();
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      values.add(machine.getBackoffMs());
    }
    expect(values.size).toBeGreaterThan(1);
  });

  it("respects max backoff cap with jitter", () => {
    const machine = new ConnectionStateMachine({ baseUrl: "http://test" });
    machine.dispatch({ type: "CONNECT", token: "t", systemId: "sys-1" as SystemId });
    for (let i = 0; i < 20; i++) {
      machine.dispatch({ type: "CONNECTION_LOST" });
      machine.dispatch({ type: "BACKOFF_COMPLETE" });
      machine.dispatch({ type: "RETRY" });
    }
    const maxWithJitter = Math.round(30_000 * JITTER_MAX);
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      expect(machine.getBackoffMs()).toBeLessThanOrEqual(maxWithJitter);
    }
  });

  it("returns values within jittered range for retry 1", () => {
    const machine = new ConnectionStateMachine({ baseUrl: "http://test" });
    machine.dispatch({ type: "CONNECT", token: "tok", systemId: "sys" as SystemId });
    machine.dispatch({ type: "CONNECTION_LOST" }); // retryCount = 1
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const delay = machine.getBackoffMs();
      expect(delay).toBeGreaterThanOrEqual(Math.round(2_000 * JITTER_MIN));
      expect(delay).toBeLessThanOrEqual(Math.round(2_000 * JITTER_MAX));
    }
  });
});
