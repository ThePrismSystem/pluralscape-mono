import { describe, expect, it } from "vitest";

import { UpdateSystemBodySchema } from "../system.js";

describe("UpdateSystemBodySchema", () => {
  it("accepts a valid body with encryptedData and version", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty encryptedData", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateSystemBodySchema.safeParse({
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects version less than 1", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative version", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string encryptedData", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: 12345,
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = UpdateSystemBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 2,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
        version: 2,
      });
    }
  });
});
