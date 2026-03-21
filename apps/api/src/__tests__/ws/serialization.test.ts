import { describe, expect, it } from "vitest";

import {
  base64urlToBytes,
  bytesToBase64url,
  serializeServerMessage,
} from "../../ws/serialization.js";
import { asSyncDocId, nonce, pubkey, sig } from "../helpers/crypto-test-fixtures.js";

import type { ServerMessage } from "@pluralscape/sync";

// ── Tests ─────────────────────────────────────────────────────────────

describe("bytesToBase64url / base64urlToBytes", () => {
  it("round-trips arbitrary byte values", () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);

    expect(decoded).toEqual(original);
  });

  it("round-trips an empty Uint8Array", () => {
    const original = new Uint8Array(0);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);

    expect(decoded).toEqual(original);
    expect(encoded).toBe("");
  });

  it("round-trips a single byte", () => {
    const original = new Uint8Array([42]);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);

    expect(decoded).toEqual(original);
  });

  it("produces URL-safe characters (no +, /, or = padding)", () => {
    // Bytes that would produce +, /, and = in standard base64
    const bytes = new Uint8Array([251, 255, 254, 253, 63, 62]);
    const encoded = bytesToBase64url(bytes);

    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("matches known test vector", () => {
    // "Hello" in ASCII = [72, 101, 108, 108, 111]
    // Standard base64 = "SGVsbG8=" -> base64url = "SGVsbG8"
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = bytesToBase64url(bytes);

    expect(encoded).toBe("SGVsbG8");
    expect(base64urlToBytes("SGVsbG8")).toEqual(bytes);
  });

  it("handles all-zeros buffer", () => {
    const original = new Uint8Array(16);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);

    expect(decoded).toEqual(original);
  });

  it("handles all-255 buffer", () => {
    const original = new Uint8Array(16).fill(255);
    const encoded = bytesToBase64url(original);
    const decoded = base64urlToBytes(encoded);

    expect(decoded).toEqual(original);
  });
});

describe("serializeServerMessage", () => {
  it("converts Uint8Array fields to base64url strings", () => {
    const msg: ServerMessage = {
      type: "SnapshotResponse",
      correlationId: crypto.randomUUID(),
      docId: asSyncDocId(crypto.randomUUID()),
      snapshot: {
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: nonce(4),
        signature: sig(7),
        authorPublicKey: pubkey(10),
        documentId: asSyncDocId(crypto.randomUUID()),
        snapshotVersion: 1,
      },
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;
    const snapshot = obj["snapshot"] as Record<string, unknown>;

    // Binary fields should be base64url strings, not arrays
    expect(typeof snapshot["ciphertext"]).toBe("string");
    expect(typeof snapshot["nonce"]).toBe("string");
    expect(typeof snapshot["signature"]).toBe("string");
    expect(typeof snapshot["authorPublicKey"]).toBe("string");

    // The base64url strings should decode back to the original bytes
    expect(base64urlToBytes(snapshot["ciphertext"] as string)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("leaves non-binary fields unaffected", () => {
    const correlationId = crypto.randomUUID();
    const docId = asSyncDocId(crypto.randomUUID());
    const msg: ServerMessage = {
      type: "SnapshotResponse",
      correlationId,
      docId,
      snapshot: null,
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;

    expect(obj["type"]).toBe("SnapshotResponse");
    expect(obj["correlationId"]).toBe(correlationId);
    expect(obj["docId"]).toBe(docId);
    expect(obj["snapshot"]).toBeNull();
  });

  it("handles messages with no binary fields", () => {
    const msg: ServerMessage = {
      type: "ChangeAccepted",
      correlationId: crypto.randomUUID(),
      docId: asSyncDocId(crypto.randomUUID()),
      assignedSeq: 42,
    };

    const serialized = serializeServerMessage(msg);
    const parsed: unknown = JSON.parse(serialized);
    const obj = parsed as Record<string, unknown>;

    expect(obj["type"]).toBe("ChangeAccepted");
    expect(obj["assignedSeq"]).toBe(42);
  });

  it("serializes nested binary fields in arrays", () => {
    const docId = asSyncDocId(crypto.randomUUID());
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
    expect(typeof firstChange["nonce"]).toBe("string");
    expect(base64urlToBytes(firstChange["ciphertext"] as string)).toEqual(new Uint8Array([10, 20]));

    // Non-binary fields in the envelope remain unchanged
    expect(firstChange["documentId"]).toBe(docId);
    expect(firstChange["seq"]).toBe(1);
  });

  it("produces valid JSON", () => {
    const msg: ServerMessage = {
      type: "SnapshotResponse",
      correlationId: crypto.randomUUID(),
      docId: asSyncDocId(crypto.randomUUID()),
      snapshot: {
        ciphertext: new Uint8Array([255, 0, 128]),
        nonce: nonce(1),
        signature: sig(2),
        authorPublicKey: pubkey(3),
        documentId: asSyncDocId(crypto.randomUUID()),
        snapshotVersion: 5,
      },
    };

    const serialized = serializeServerMessage(msg);

    expect(() => {
      JSON.parse(serialized);
    }).not.toThrow();
  });
});
