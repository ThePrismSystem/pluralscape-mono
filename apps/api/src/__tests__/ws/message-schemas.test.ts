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
    const validBase64url = Buffer.from("test-data").toString("base64url");

    it("accepts valid request with base64url binary fields", () => {
      const result = submitChangeRequestSchema.safeParse({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId: "fronting-sys_test",
        change: {
          ciphertext: validBase64url,
          nonce: validBase64url,
          signature: validBase64url,
          authorPublicKey: validBase64url,
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
          nonce: validBase64url,
          signature: validBase64url,
          authorPublicKey: validBase64url,
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
