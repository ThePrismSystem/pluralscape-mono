import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { describe, expect, it } from "vitest";

import {
  CLIENT_MESSAGE_SCHEMAS,
  MUTATION_MESSAGE_TYPES,
  authenticateRequestSchema,
  fetchChangesRequestSchema,
  submitChangeRequestSchema,
  subscribeRequestSchema,
} from "../../ws/message-schemas.js";

/** Generate a base64url string that decodes to exactly `n` bytes. */
function base64urlOfLength(n: number): string {
  return Buffer.from(new Uint8Array(n)).toString("base64url");
}

describe("message-schemas", () => {
  describe("AuthenticateRequest", () => {
    it("accepts valid request", () => {
      const result = authenticateRequestSchema.safeParse({
        type: "AuthenticateRequest",
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        protocolVersion: SYNC_PROTOCOL_VERSION,
        sessionToken: "a".repeat(64),
        systemId: "sys_test",
        profileType: "owner-full",
      });
      expect(result.success).toBe(true);
    });

    it("rejects wrong protocol version", () => {
      const result = authenticateRequestSchema.safeParse({
        type: "AuthenticateRequest",
        correlationId: null,
        protocolVersion: 999,
        sessionToken: "a".repeat(64),
        systemId: "sys_test",
        profileType: "owner-full",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid session token format", () => {
      const result = authenticateRequestSchema.safeParse({
        type: "AuthenticateRequest",
        correlationId: null,
        protocolVersion: SYNC_PROTOCOL_VERSION,
        sessionToken: "not-a-hex-token",
        systemId: "sys_test",
        profileType: "owner-full",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid profile type", () => {
      const result = authenticateRequestSchema.safeParse({
        type: "AuthenticateRequest",
        correlationId: null,
        protocolVersion: SYNC_PROTOCOL_VERSION,
        sessionToken: "a".repeat(64),
        systemId: "sys_test",
        profileType: "admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("SubscribeRequest", () => {
    it("accepts valid request with documents", () => {
      const result = subscribeRequestSchema.safeParse({
        type: "SubscribeRequest",
        correlationId: null,
        documents: [{ docId: "fronting-sys_test", lastSyncedSeq: 5, lastSnapshotVersion: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative lastSyncedSeq", () => {
      const result = subscribeRequestSchema.safeParse({
        type: "SubscribeRequest",
        correlationId: null,
        documents: [{ docId: "fronting-sys_test", lastSyncedSeq: -1, lastSnapshotVersion: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it("accepts 100 documents (at the limit)", () => {
      const documents = Array.from({ length: 100 }, (_, i) => ({
        docId: `doc-${String(i)}`,
        lastSyncedSeq: 0,
        lastSnapshotVersion: 0,
      }));
      const result = subscribeRequestSchema.safeParse({
        type: "SubscribeRequest",
        correlationId: null,
        documents,
      });
      expect(result.success).toBe(true);
    });

    it("rejects 101 documents (over the limit)", () => {
      const documents = Array.from({ length: 101 }, (_, i) => ({
        docId: `doc-${String(i)}`,
        lastSyncedSeq: 0,
        lastSnapshotVersion: 0,
      }));
      const result = subscribeRequestSchema.safeParse({
        type: "SubscribeRequest",
        correlationId: null,
        documents,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("FetchChangesRequest", () => {
    it("accepts valid request", () => {
      const result = fetchChangesRequestSchema.safeParse({
        type: "FetchChangesRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        sinceSeq: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SubmitChangeRequest", () => {
    it("accepts valid request with correct byte lengths", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: base64urlOfLength(32),
          nonce: base64urlOfLength(24),
          signature: base64urlOfLength(64),
          authorPublicKey: base64urlOfLength(32),
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.change.ciphertext).toBeInstanceOf(Uint8Array);
      }
    });

    it("rejects empty base64url fields", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: "",
          nonce: base64urlOfLength(24),
          signature: base64urlOfLength(64),
          authorPublicKey: base64urlOfLength(32),
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid base64url characters", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: "valid-data",
          nonce: "invalid+chars/here=", // standard base64, not base64url
          signature: base64urlOfLength(64),
          authorPublicKey: base64urlOfLength(32),
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong nonce byte length", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: base64urlOfLength(32),
          nonce: base64urlOfLength(16), // 16 bytes, should be 24
          signature: base64urlOfLength(64),
          authorPublicKey: base64urlOfLength(32),
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong signature byte length", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: base64urlOfLength(32),
          nonce: base64urlOfLength(24),
          signature: base64urlOfLength(32), // 32 bytes, should be 64
          authorPublicKey: base64urlOfLength(32),
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong authorPublicKey byte length", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: base64urlOfLength(32),
          nonce: base64urlOfLength(24),
          signature: base64urlOfLength(64),
          authorPublicKey: base64urlOfLength(16), // 16 bytes, should be 32
          documentId: "fronting-sys_test",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CLIENT_MESSAGE_SCHEMAS", () => {
    it("has all 9 message types", () => {
      expect(Object.keys(CLIENT_MESSAGE_SCHEMAS)).toHaveLength(9);
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("AuthenticateRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("ManifestRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("SubscribeRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("UnsubscribeRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("FetchSnapshotRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("FetchChangesRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("SubmitChangeRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("SubmitSnapshotRequest");
      expect(CLIENT_MESSAGE_SCHEMAS).toHaveProperty("DocumentLoadRequest");
    });
  });

  describe("MUTATION_MESSAGE_TYPES", () => {
    it("contains only mutation types", () => {
      expect(MUTATION_MESSAGE_TYPES.has("SubmitChangeRequest")).toBe(true);
      expect(MUTATION_MESSAGE_TYPES.has("SubmitSnapshotRequest")).toBe(true);
      expect(MUTATION_MESSAGE_TYPES.has("FetchChangesRequest")).toBe(false);
      expect(MUTATION_MESSAGE_TYPES.has("ManifestRequest")).toBe(false);
    });
  });
});
