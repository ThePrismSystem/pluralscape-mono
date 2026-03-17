import { describe, expect, it } from "vitest";

import { CreateCustomFrontBodySchema, UpdateCustomFrontBodySchema } from "../custom-front.js";
import { MAX_ENCRYPTED_CUSTOM_FRONT_DATA_SIZE } from "../validation.constants.js";

describe("CreateCustomFrontBodySchema", () => {
  it("accepts a valid body", () => {
    const result = CreateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateCustomFrontBodySchema.safeParse({
      encryptedData: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateCustomFrontBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const oversized = "x".repeat(MAX_ENCRYPTED_CUSTOM_FRONT_DATA_SIZE + 1);
    const result = CreateCustomFrontBodySchema.safeParse({
      encryptedData: oversized,
    });
    expect(result.success).toBe(false);
  });

  it("accepts encryptedData at exactly max size", () => {
    const atLimit = "x".repeat(MAX_ENCRYPTED_CUSTOM_FRONT_DATA_SIZE);
    const result = CreateCustomFrontBodySchema.safeParse({
      encryptedData: atLimit,
    });
    expect(result.success).toBe(true);
  });

  it("strips extra properties", () => {
    const result = CreateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        encryptedData: "dGVzdA==",
      });
    }
  });
});

describe("UpdateCustomFrontBodySchema", () => {
  it("accepts a valid body", () => {
    const result = UpdateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version less than 1", () => {
    const result = UpdateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateCustomFrontBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string encryptedData", () => {
    const result = UpdateCustomFrontBodySchema.safeParse({
      encryptedData: 12345,
      version: 1,
    });
    expect(result.success).toBe(false);
  });
});
