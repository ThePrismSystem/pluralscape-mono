import { describe, expect, expectTypeOf, it } from "vitest";

import {
  SYNC_PROTOCOL_VERSION,
  type AuthenticateRequest,
  type ClientMessage,
  type DocumentLoadRequest,
  type DocumentUpdate,
  type ManifestChanged,
  type ServerMessage,
  type SyncErrorCode,
  type SyncTransport,
  type TransportState,
} from "../protocol.js";

// ── SYNC_PROTOCOL_VERSION ────────────────────────────────────────────

describe("SYNC_PROTOCOL_VERSION", () => {
  it("equals 1", () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(1);
  });
});

// ── SyncErrorCode ────────────────────────────────────────────────────

describe("SyncErrorCode", () => {
  it("exhaustive array of all 13 codes compiles as SyncErrorCode[]", () => {
    const allCodes: SyncErrorCode[] = [
      "AUTH_FAILED",
      "AUTH_EXPIRED",
      "PERMISSION_DENIED",
      "DOCUMENT_NOT_FOUND",
      "DOCUMENT_LOAD_DENIED",
      "SNAPSHOT_NOT_FOUND",
      "VERSION_CONFLICT",
      "MALFORMED_MESSAGE",
      "QUOTA_EXCEEDED",
      "RATE_LIMITED",
      "INVALID_ENVELOPE",
      "PROTOCOL_MISMATCH",
      "INTERNAL_ERROR",
    ];
    expect(allCodes).toHaveLength(13);
  });

  it("includes DOCUMENT_LOAD_DENIED", () => {
    const code: SyncErrorCode = "DOCUMENT_LOAD_DENIED";
    expect(code).toBe("DOCUMENT_LOAD_DENIED");
  });

  it("includes SNAPSHOT_NOT_FOUND", () => {
    const code: SyncErrorCode = "SNAPSHOT_NOT_FOUND";
    expect(code).toBe("SNAPSHOT_NOT_FOUND");
  });
});

// ── ClientMessage ────────────────────────────────────────────────────

describe("ClientMessage", () => {
  it("all 9 type discriminants are unique", () => {
    const discriminants: ClientMessage["type"][] = [
      "AuthenticateRequest",
      "ManifestRequest",
      "SubscribeRequest",
      "UnsubscribeRequest",
      "FetchSnapshotRequest",
      "FetchChangesRequest",
      "SubmitChangeRequest",
      "SubmitSnapshotRequest",
      "DocumentLoadRequest",
    ];
    const unique = new Set(discriminants);
    expect(unique.size).toBe(discriminants.length);
    expect(discriminants).toHaveLength(9);
  });

  it("DocumentLoadRequest uses docId field", () => {
    const msg: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: "test-123",
      docId: "fronting-sys_abc-2026-Q1",
      persist: true,
    };
    expect(msg.docId).toBe("fronting-sys_abc-2026-Q1");
    expectTypeOf(msg).toHaveProperty("docId");
  });
});

// ── ServerMessage ────────────────────────────────────────────────────

describe("ServerMessage", () => {
  it("all 10 type discriminants are unique", () => {
    const discriminants: ServerMessage["type"][] = [
      "AuthenticateResponse",
      "ManifestResponse",
      "SubscribeResponse",
      "DocumentUpdate",
      "SnapshotResponse",
      "ChangesResponse",
      "ChangeAccepted",
      "SnapshotAccepted",
      "ManifestChanged",
      "SyncError",
    ];
    const unique = new Set(discriminants);
    expect(unique.size).toBe(discriminants.length);
    expect(discriminants).toHaveLength(10);
  });

  it("DocumentUpdate.correlationId is null", () => {
    expectTypeOf<DocumentUpdate["correlationId"]>().toEqualTypeOf<null>();
  });

  it("ManifestChanged.correlationId is null", () => {
    expectTypeOf<ManifestChanged["correlationId"]>().toEqualTypeOf<null>();
  });
});

// ── AuthenticateRequest ──────────────────────────────────────────────

describe("AuthenticateRequest", () => {
  it("protocolVersion accepts SYNC_PROTOCOL_VERSION", () => {
    const msg: AuthenticateRequest = {
      type: "AuthenticateRequest",
      correlationId: "auth-1",
      protocolVersion: SYNC_PROTOCOL_VERSION,
      sessionToken: "token-abc",
      systemId: "sys_123",
      profileType: "owner-full",
    };
    expect(msg.protocolVersion).toBe(SYNC_PROTOCOL_VERSION);
  });

  it("protocolVersion rejects arbitrary numbers (type-level test)", () => {
    const _msg: AuthenticateRequest = {
      type: "AuthenticateRequest",
      correlationId: "auth-2",
      // @ts-expect-error protocolVersion must be typeof SYNC_PROTOCOL_VERSION, not arbitrary number
      protocolVersion: 99,
      sessionToken: "token-abc",
      systemId: "sys_123",
      profileType: "owner-full",
    };
    expect(_msg.protocolVersion).toBe(99);
  });
});

// ── SyncTransport ────────────────────────────────────────────────────

describe("SyncTransport", () => {
  it("state property is TransportState", () => {
    expectTypeOf<SyncTransport["state"]>().toEqualTypeOf<TransportState>();
  });
});
