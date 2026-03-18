import { KEY_ROTATION } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import {
  ClaimChunkBodySchema,
  CompleteChunkBodySchema,
  InitiateRotationBodySchema,
} from "../key-rotation.js";

// ── InitiateRotationBodySchema ───────────────────────────────────────

describe("InitiateRotationBodySchema", () => {
  const validInput = {
    wrappedNewKey: "wrapped-key-value",
    newKeyVersion: 2,
    friendKeyGrants: [{ friendAccountId: "account-1", encryptedKey: "enc-key-1" }],
  };

  it("accepts valid input", () => {
    const result = InitiateRotationBodySchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });

  it("accepts an empty friendKeyGrants array", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      friendKeyGrants: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts newKeyVersion at minimum boundary (2)", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      newKeyVersion: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects newKeyVersion below minimum (1)", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      newKeyVersion: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newKeyVersion"]);
    }
  });

  it("rejects non-integer newKeyVersion", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      newKeyVersion: 2.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newKeyVersion"]);
    }
  });

  it("rejects missing wrappedNewKey", () => {
    const result = InitiateRotationBodySchema.safeParse({
      newKeyVersion: validInput.newKeyVersion,
      friendKeyGrants: validInput.friendKeyGrants,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["wrappedNewKey"]);
    }
  });

  it("rejects empty wrappedNewKey", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      wrappedNewKey: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["wrappedNewKey"]);
    }
  });

  it("rejects missing newKeyVersion", () => {
    const result = InitiateRotationBodySchema.safeParse({
      wrappedNewKey: validInput.wrappedNewKey,
      friendKeyGrants: validInput.friendKeyGrants,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["newKeyVersion"]);
    }
  });

  it("rejects missing friendKeyGrants", () => {
    const result = InitiateRotationBodySchema.safeParse({
      wrappedNewKey: validInput.wrappedNewKey,
      newKeyVersion: validInput.newKeyVersion,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["friendKeyGrants"]);
    }
  });

  it("rejects a friendKeyGrant with empty friendAccountId", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      friendKeyGrants: [{ friendAccountId: "", encryptedKey: "enc-key" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["friendKeyGrants", 0, "friendAccountId"]);
    }
  });

  it("rejects a friendKeyGrant with empty encryptedKey", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      friendKeyGrants: [{ friendAccountId: "account-1", encryptedKey: "" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["friendKeyGrants", 0, "encryptedKey"]);
    }
  });

  it("strips unknown properties", () => {
    const result = InitiateRotationBodySchema.safeParse({
      ...validInput,
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("extra" in result.data).toBe(false);
    }
  });
});

// ── ClaimChunkBodySchema ─────────────────────────────────────────────

describe("ClaimChunkBodySchema", () => {
  it("applies default chunkSize when input is empty object", () => {
    const result = ClaimChunkBodySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chunkSize).toBe(KEY_ROTATION.defaultChunkSize);
    }
  });

  it("accepts chunkSize at minimum boundary (1)", () => {
    const result = ClaimChunkBodySchema.safeParse({ chunkSize: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chunkSize).toBe(1);
    }
  });

  it("accepts chunkSize at maximum boundary (200)", () => {
    const result = ClaimChunkBodySchema.safeParse({
      chunkSize: KEY_ROTATION.maxChunkSize,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chunkSize).toBe(KEY_ROTATION.maxChunkSize);
    }
  });

  it("rejects chunkSize below minimum (0)", () => {
    const result = ClaimChunkBodySchema.safeParse({ chunkSize: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["chunkSize"]);
    }
  });

  it("rejects chunkSize above maximum (201)", () => {
    const result = ClaimChunkBodySchema.safeParse({
      chunkSize: KEY_ROTATION.maxChunkSize + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["chunkSize"]);
    }
  });

  it("rejects non-integer chunkSize", () => {
    const result = ClaimChunkBodySchema.safeParse({ chunkSize: 10.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["chunkSize"]);
    }
  });
});

// ── CompleteChunkBodySchema ──────────────────────────────────────────

describe("CompleteChunkBodySchema", () => {
  const validItem = { itemId: "item-abc", status: "completed" as const };

  it("accepts a valid list with completed status", () => {
    const result = CompleteChunkBodySchema.safeParse({ items: [validItem] });
    expect(result.success).toBe(true);
  });

  it("accepts a valid list with failed status", () => {
    const result = CompleteChunkBodySchema.safeParse({
      items: [{ itemId: "item-xyz", status: "failed" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple items with mixed statuses", () => {
    const result = CompleteChunkBodySchema.safeParse({
      items: [
        { itemId: "item-1", status: "completed" },
        { itemId: "item-2", status: "failed" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = CompleteChunkBodySchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["items"]);
    }
  });

  it("rejects missing items field", () => {
    const result = CompleteChunkBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["items"]);
    }
  });

  it("rejects an invalid status value", () => {
    const result = CompleteChunkBodySchema.safeParse({
      items: [{ itemId: "item-abc", status: "pending" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["items", 0, "status"]);
    }
  });

  it("rejects an item with empty itemId", () => {
    const result = CompleteChunkBodySchema.safeParse({
      items: [{ itemId: "", status: "completed" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["items", 0, "itemId"]);
    }
  });

  it("rejects an item with missing itemId", () => {
    const result = CompleteChunkBodySchema.safeParse({
      items: [{ status: "completed" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["items", 0, "itemId"]);
    }
  });
});
