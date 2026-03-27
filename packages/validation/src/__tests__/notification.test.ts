import { describe, expect, it } from "vitest";

import {
  RegisterDeviceTokenBodySchema,
  UpdateFriendNotificationPreferenceBodySchema,
  UpdateNotificationConfigBodySchema,
} from "../notification.js";
import { MAX_DEVICE_TOKEN_LENGTH } from "../validation.constants.js";

// ── RegisterDeviceTokenBodySchema ────────────────────────────────────

describe("RegisterDeviceTokenBodySchema", () => {
  it("accepts valid ios token", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
      token: "abc123-device-token",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe("ios");
      expect(result.data.token).toBe("abc123-device-token");
    }
  });

  it("accepts valid android token", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "android",
      token: "fcm-token-value",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid web token", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "web",
      token: "web-push-subscription-endpoint",
    });
    expect(result.success).toBe(true);
  });

  it("accepts token at exactly max length", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
      token: "x".repeat(MAX_DEVICE_TOKEN_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("rejects token exceeding max length", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
      token: "x".repeat(MAX_DEVICE_TOKEN_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty token", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
      token: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing platform", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      token: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown platform", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "blackberry",
      token: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = RegisterDeviceTokenBodySchema.safeParse({
      platform: "ios",
      token: "abc123",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ platform: "ios", token: "abc123" });
    }
  });
});

// ── UpdateNotificationConfigBodySchema ───────────────────────────────

describe("UpdateNotificationConfigBodySchema", () => {
  it("accepts both fields", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({
      enabled: true,
      pushEnabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts enabled only", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts pushEnabled only", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({
      pushEnabled: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (no fields)", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean enabled", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({
      enabled: "true",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean pushEnabled", () => {
    const result = UpdateNotificationConfigBodySchema.safeParse({
      pushEnabled: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ── UpdateFriendNotificationPreferenceBodySchema ─────────────────────

describe("UpdateFriendNotificationPreferenceBodySchema", () => {
  it("accepts valid event types", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({
      enabledEventTypes: ["friend-switch-alert"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledEventTypes).toEqual(["friend-switch-alert"]);
    }
  });

  it("accepts empty array (clearing all events)", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({
      enabledEventTypes: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledEventTypes).toEqual([]);
    }
  });

  it("rejects unknown event type", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({
      enabledEventTypes: ["unknown-event"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-array enabledEventTypes", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({
      enabledEventTypes: "friend-switch-alert",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing enabledEventTypes", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects mixed valid and invalid event types", () => {
    const result = UpdateFriendNotificationPreferenceBodySchema.safeParse({
      enabledEventTypes: ["friend-switch-alert", "invalid-type"],
    });
    expect(result.success).toBe(false);
  });
});
