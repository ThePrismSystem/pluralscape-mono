import { describe, expect, it } from "vitest";

import { narrowDeviceToken, narrowDeviceTokenPage } from "../device-token.js";

import type { DeviceTokenRaw } from "../device-token.js";
import type {
  AccountId,
  DeviceTokenId,
  DeviceTokenPlatform,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

const NOW = 1_700_000_000_000 as UnixMillis;

function makeRaw(overrides?: Partial<DeviceTokenRaw>): DeviceTokenRaw {
  return {
    id: "dt_test0001" as DeviceTokenId,
    accountId: "acc_test001" as AccountId,
    systemId: "sys_test001" as SystemId,
    platform: "ios" as DeviceTokenPlatform,
    token: "device-push-token-abc123",
    lastActiveAt: NOW,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("narrowDeviceToken", () => {
  it("returns device token with all fields", () => {
    const result = narrowDeviceToken(makeRaw());
    expect(result.id).toBe("dt_test0001");
    expect(result.accountId).toBe("acc_test001");
    expect(result.systemId).toBe("sys_test001");
    expect(result.platform).toBe("ios");
    expect(result.token).toBe("device-push-token-abc123");
    expect(result.lastActiveAt).toBe(NOW);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("handles null lastActiveAt", () => {
    const result = narrowDeviceToken(makeRaw({ lastActiveAt: null }));
    expect(result.lastActiveAt).toBeNull();
  });

  it("handles android platform", () => {
    const result = narrowDeviceToken(makeRaw({ platform: "android" as DeviceTokenPlatform }));
    expect(result.platform).toBe("android");
  });

  it("handles web platform", () => {
    const result = narrowDeviceToken(makeRaw({ platform: "web" as DeviceTokenPlatform }));
    expect(result.platform).toBe("web");
  });
});

describe("narrowDeviceTokenPage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = narrowDeviceTokenPage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowDeviceTokenPage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
