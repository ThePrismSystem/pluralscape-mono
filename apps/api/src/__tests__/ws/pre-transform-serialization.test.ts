/**
 * Tests for M10: Pre-transform serialization.
 *
 * Verifies that transformBinaryFields recursively converts Uint8Array
 * fields to base64url strings before JSON.stringify, rather than using
 * a JSON replacer.
 */
import { describe, expect, it } from "vitest";

import {
  base64urlToBytes,
  bytesToBase64url,
  serializeServerMessage,
  transformBinaryFields,
} from "../../ws/serialization.js";
import { nonce, pubkey, sig } from "../helpers/crypto-test-fixtures.js";

import type { ServerMessage } from "@pluralscape/sync";

// ── transformBinaryFields tests ──────────────────────────────────────

describe("transformBinaryFields", () => {
  it("converts top-level Uint8Array to base64url string", () => {
    const input = { data: new Uint8Array([1, 2, 3]) };
    const result = transformBinaryFields(input) as Record<string, unknown>;

    expect(typeof result["data"]).toBe("string");
    expect(base64urlToBytes(result["data"] as string)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("converts nested Uint8Array fields", () => {
    const input = {
      snapshot: {
        ciphertext: new Uint8Array([10, 20]),
        nonce: new Uint8Array([30, 40]),
        version: 1,
      },
    };
    const result = transformBinaryFields(input) as { snapshot: Record<string, unknown> };
    const snapshot = result.snapshot;

    expect(typeof snapshot["ciphertext"]).toBe("string");
    expect(typeof snapshot["nonce"]).toBe("string");
    expect(snapshot["version"]).toBe(1);
  });

  it("converts Uint8Array fields inside arrays", () => {
    const input = {
      changes: [
        { ciphertext: new Uint8Array([1]), seq: 1 },
        { ciphertext: new Uint8Array([2]), seq: 2 },
      ],
    };
    const result = transformBinaryFields(input) as { changes: Record<string, unknown>[] };
    const first = result.changes[0] as Record<string, unknown>;
    const second = result.changes[1] as Record<string, unknown>;

    expect(typeof first["ciphertext"]).toBe("string");
    expect(typeof second["ciphertext"]).toBe("string");
    expect(first["seq"]).toBe(1);
    expect(second["seq"]).toBe(2);
  });

  it("leaves non-binary fields unchanged", () => {
    const input = { type: "test", count: 42, flag: true, empty: null };
    const result = transformBinaryFields(input) as Record<string, unknown>;

    expect(result["type"]).toBe("test");
    expect(result["count"]).toBe(42);
    expect(result["flag"]).toBe(true);
    expect(result["empty"]).toBeNull();
  });

  it("returns null for null input", () => {
    expect(transformBinaryFields(null)).toBeNull();
  });

  it("returns primitives unchanged", () => {
    expect(transformBinaryFields("hello")).toBe("hello");
    expect(transformBinaryFields(42)).toBe(42);
    expect(transformBinaryFields(true)).toBe(true);
  });

  it("handles empty objects", () => {
    const result = transformBinaryFields({});
    expect(result).toEqual({});
  });

  it("handles empty arrays", () => {
    const result = transformBinaryFields([]);
    expect(result).toEqual([]);
  });
});

describe("serializeServerMessage (pre-transform)", () => {
  it("produces identical output to replacer-based approach for messages with binary fields", () => {
    const msg: ServerMessage = {
      type: "SnapshotResponse",
      correlationId: crypto.randomUUID(),
      docId: crypto.randomUUID(),
      snapshot: {
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: nonce(4),
        signature: sig(7),
        authorPublicKey: pubkey(10),
        documentId: crypto.randomUUID(),
        snapshotVersion: 1,
      },
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;
    const snapshot = obj["snapshot"] as Record<string, unknown>;

    // Binary fields should be base64url strings
    expect(typeof snapshot["ciphertext"]).toBe("string");
    expect(typeof snapshot["nonce"]).toBe("string");
    expect(typeof snapshot["signature"]).toBe("string");
    expect(typeof snapshot["authorPublicKey"]).toBe("string");

    // Verify correctness
    expect(base64urlToBytes(snapshot["ciphertext"] as string)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("handles messages with no binary fields", () => {
    const msg: ServerMessage = {
      type: "ChangeAccepted",
      correlationId: crypto.randomUUID(),
      docId: crypto.randomUUID(),
      assignedSeq: 42,
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;

    expect(obj["type"]).toBe("ChangeAccepted");
    expect(obj["assignedSeq"]).toBe(42);
  });

  it("handles nested arrays of envelopes with binary fields", () => {
    const docId = crypto.randomUUID();
    const msg: ServerMessage = {
      type: "ChangesResponse",
      correlationId: crypto.randomUUID(),
      docId,
      changes: [
        {
          ciphertext: new Uint8Array([10, 20]),
          nonce: nonce(1),
          signature: sig(2),
          authorPublicKey: pubkey(3),
          documentId: docId,
          seq: 1,
        },
      ],
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;
    const changes = obj["changes"] as Record<string, unknown>[];
    const firstChange = changes[0] as Record<string, unknown>;

    expect(typeof firstChange["ciphertext"]).toBe("string");
    expect(firstChange["seq"]).toBe(1);
  });

  it("produces valid JSON", () => {
    const msg: ServerMessage = {
      type: "SnapshotResponse",
      correlationId: crypto.randomUUID(),
      docId: crypto.randomUUID(),
      snapshot: {
        ciphertext: new Uint8Array([255, 0, 128]),
        nonce: nonce(1),
        signature: sig(2),
        authorPublicKey: pubkey(3),
        documentId: crypto.randomUUID(),
        snapshotVersion: 5,
      },
    };

    const serialized = serializeServerMessage(msg);

    expect(() => {
      JSON.parse(serialized);
    }).not.toThrow();
  });

  it("bytesToBase64url is consistent with transformBinaryFields", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const directEncoding = bytesToBase64url(bytes);
    const transformed = transformBinaryFields({ field: bytes }) as Record<string, unknown>;

    expect(transformed["field"]).toBe(directEncoding);
  });
});
