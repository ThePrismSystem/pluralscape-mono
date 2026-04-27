import { describe, expect, it } from "vitest";

import { DeviceInfoSchema } from "../session.js";

describe("DeviceInfoSchema", () => {
  it("accepts a fully-populated DeviceInfo", () => {
    const result = DeviceInfoSchema.safeParse({
      platform: "ios",
      appVersion: "1.0.0",
      deviceName: "iPhone 15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe("ios");
      expect(result.data.appVersion).toBe("1.0.0");
      expect(result.data.deviceName).toBe("iPhone 15");
    }
  });

  it("rejects a payload missing platform", () => {
    const result = DeviceInfoSchema.safeParse({
      appVersion: "1.0.0",
      deviceName: "Pixel 7",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing appVersion", () => {
    const result = DeviceInfoSchema.safeParse({
      platform: "android",
      deviceName: "Pixel 7",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing deviceName", () => {
    const result = DeviceInfoSchema.safeParse({
      platform: "android",
      appVersion: "1.0.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string platform", () => {
    const result = DeviceInfoSchema.safeParse({
      platform: 42,
      appVersion: "1.0.0",
      deviceName: "Tablet",
    });
    expect(result.success).toBe(false);
  });
});
