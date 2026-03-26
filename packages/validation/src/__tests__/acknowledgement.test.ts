import { describe, expect, it } from "vitest";

import {
  AcknowledgementQuerySchema,
  ConfirmAcknowledgementBodySchema,
  CreateAcknowledgementBodySchema,
} from "../acknowledgement.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

/** Remove a key from an object (lint-safe alternative to destructuring with _). */
function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>;
}

// ── CreateAcknowledgementBodySchema ─────────────────────────────

describe("CreateAcknowledgementBodySchema", () => {
  const valid = {
    encryptedData: "dGVzdA==",
  };

  it("accepts minimal valid input", () => {
    const result = CreateAcknowledgementBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encryptedData).toBe("dGVzdA==");
      expect(result.data.createdByMemberId).toBeUndefined();
    }
  });

  it("accepts with optional createdByMemberId", () => {
    const memberId = "mem_00000000-0000-0000-0000-000000000001";
    const result = CreateAcknowledgementBodySchema.safeParse({
      ...valid,
      createdByMemberId: memberId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdByMemberId).toBe(memberId);
    }
  });

  it("rejects invalid createdByMemberId prefix", () => {
    expect(
      CreateAcknowledgementBodySchema.safeParse({
        ...valid,
        createdByMemberId: "usr_00000000-0000-0000-0000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    expect(CreateAcknowledgementBodySchema.safeParse(omit(valid, "encryptedData")).success).toBe(
      false,
    );
  });

  it("rejects empty encryptedData", () => {
    expect(CreateAcknowledgementBodySchema.safeParse({ ...valid, encryptedData: "" }).success).toBe(
      false,
    );
  });

  it("rejects encryptedData exceeding max size", () => {
    expect(
      CreateAcknowledgementBodySchema.safeParse({
        ...valid,
        encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      }).success,
    ).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreateAcknowledgementBodySchema.safeParse({ ...valid, extra: "field" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });
});

// ── ConfirmAcknowledgementBodySchema ────────────────────────────

describe("ConfirmAcknowledgementBodySchema", () => {
  it("accepts empty body", () => {
    const result = ConfirmAcknowledgementBodySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encryptedData).toBeUndefined();
    }
  });

  it("accepts with optional encryptedData", () => {
    const result = ConfirmAcknowledgementBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encryptedData).toBe("dGVzdA==");
    }
  });

  it("rejects empty encryptedData string", () => {
    expect(ConfirmAcknowledgementBodySchema.safeParse({ encryptedData: "" }).success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    expect(
      ConfirmAcknowledgementBodySchema.safeParse({
        encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      }).success,
    ).toBe(false);
  });

  it("strips extra properties", () => {
    const result = ConfirmAcknowledgementBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("extra" in result.data).toBe(false);
    }
  });
});

// ── AcknowledgementQuerySchema ──────────────────────────────────

describe("AcknowledgementQuerySchema", () => {
  it("accepts empty query", () => {
    expect(AcknowledgementQuerySchema.safeParse({}).success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = AcknowledgementQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("defaults includeArchived to false", () => {
    const result = AcknowledgementQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });

  it("parses confirmed=true filter", () => {
    const result = AcknowledgementQuerySchema.safeParse({ confirmed: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBe(true);
    }
  });

  it("parses confirmed=false filter", () => {
    const result = AcknowledgementQuerySchema.safeParse({ confirmed: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBe(false);
    }
  });

  it("leaves confirmed undefined when not provided", () => {
    const result = AcknowledgementQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmed).toBeUndefined();
    }
  });

  it("rejects invalid confirmed value", () => {
    expect(AcknowledgementQuerySchema.safeParse({ confirmed: "maybe" }).success).toBe(false);
  });

  it("rejects invalid includeArchived value", () => {
    expect(AcknowledgementQuerySchema.safeParse({ includeArchived: "yes" }).success).toBe(false);
  });
});
