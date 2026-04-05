import { describe, expect, it, vi } from "vitest";

import { NotificationBridge } from "../notification-bridge.js";

interface TestConnection {
  send: ReturnType<typeof vi.fn<(data: string) => undefined>>;
  readyState: number;
}

function makeConnection(readyState = 1): TestConnection {
  return { send: vi.fn<(data: string) => undefined>(), readyState };
}

describe("NotificationBridge", () => {
  it("registers and sends to a connected account", () => {
    const bridge = new NotificationBridge();
    const conn = makeConnection();
    bridge.register("acc-1", conn);
    bridge.notify("acc-1", { hello: "world" });
    expect(conn.send).toHaveBeenCalledOnce();
    const firstCallArg = conn.send.mock.calls[0]?.[0];
    if (firstCallArg === undefined) throw new Error("send was not called");
    expect(JSON.parse(firstCallArg)).toEqual({
      type: "Notification",
      payload: { hello: "world" },
    });
  });

  it("does not send to unregistered accounts without error", () => {
    const bridge = new NotificationBridge();
    expect(() => {
      bridge.notify("acc-unknown", { x: 1 });
    }).not.toThrow();
  });

  it("sends to multiple connections for the same account", () => {
    const bridge = new NotificationBridge();
    const conn1 = makeConnection();
    const conn2 = makeConnection();
    bridge.register("acc-2", conn1);
    bridge.register("acc-2", conn2);
    bridge.notify("acc-2", { msg: "hi" });
    expect(conn1.send).toHaveBeenCalledOnce();
    expect(conn2.send).toHaveBeenCalledOnce();
  });

  it("skips connections that are not OPEN (readyState !== 1)", () => {
    const bridge = new NotificationBridge();
    const closed = makeConnection(3);
    const open = makeConnection(1);
    bridge.register("acc-3", closed);
    bridge.register("acc-3", open);
    bridge.notify("acc-3", { ping: true });
    expect(closed.send).not.toHaveBeenCalled();
    expect(open.send).toHaveBeenCalledOnce();
  });

  it("unregister removes the connection", () => {
    const bridge = new NotificationBridge();
    const conn = makeConnection();
    const unregister = bridge.register("acc-4", conn);
    unregister();
    bridge.notify("acc-4", { after: "unregister" });
    expect(conn.send).not.toHaveBeenCalled();
  });

  it("unregister cleans up the set when the last connection is removed", () => {
    const bridge = new NotificationBridge();
    const conn = makeConnection();
    const unregister = bridge.register("acc-5", conn);
    unregister();
    // Second notify should not throw even though the set was cleaned up
    expect(() => {
      bridge.notify("acc-5", {});
    }).not.toThrow();
  });
});
