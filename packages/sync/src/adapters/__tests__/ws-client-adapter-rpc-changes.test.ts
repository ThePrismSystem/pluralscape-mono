import { afterEach, describe, expect, it, vi } from "vitest";

import { nonce, pubkey, sig } from "../../__tests__/test-crypto-helpers.js";

import {
  asSyncDocId,
  createTestHarness,
  resetMockInstances,
} from "./helpers/ws-client-adapter-fixtures.js";

afterEach(() => {
  resetMockInstances();
});

describe("createWsClientAdapter — submitChange", () => {
  it("resolves with the accepted change envelope", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-submit");

    const change = {
      ciphertext: new Uint8Array([1, 2, 3]),
      nonce: nonce(0),
      signature: sig(0),
      authorPublicKey: pubkey(0),
      documentId: docId,
    };

    const submitPromise = harness.adapter.submitChange(docId, change);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitChangeRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitChangeRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "ChangeAccepted",
      correlationId: submitReq.correlationId,
      assignedSeq: 42,
      docId,
    });

    const result = await submitPromise;
    expect(result.seq).toBe(42);
    expect(result.documentId).toBe(docId);
  });

  it("throws SyncProtocolError when server returns SyncError", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-submit-err");

    const change = {
      ciphertext: new Uint8Array(0),
      nonce: nonce(1),
      signature: sig(1),
      authorPublicKey: pubkey(1),
      documentId: docId,
    };

    const submitPromise = harness.adapter.submitChange(docId, change);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitChangeRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitChangeRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "SyncError",
      correlationId: submitReq.correlationId,
      code: "VERSION_CONFLICT",
      message: "conflict",
      docId,
    });

    await expect(submitPromise).rejects.toThrow("VERSION_CONFLICT");
  });
});

describe("createWsClientAdapter — fetchChangesSince", () => {
  it("returns changes from response", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-fetch-changes");

    const fetchPromise = harness.adapter.fetchChangesSince(docId, 0);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchChangesRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const fetchReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "FetchChangesRequest",
    ) as { correlationId: string };

    const fakeChange = {
      ciphertext: [],
      nonce: [],
      signature: [],
      authorPublicKey: [],
      documentId: docId,
      seq: 7,
    };

    mock.simulateMessage({
      type: "ChangesResponse",
      correlationId: fetchReq.correlationId,
      changes: [fakeChange],
      docId,
    });

    const changes = await fetchPromise;
    expect(changes).toHaveLength(1);
  });

  it("returns empty array when no changes", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-fetch-empty");

    const fetchPromise = harness.adapter.fetchChangesSince(docId, 5);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchChangesRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const fetchReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "FetchChangesRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "ChangesResponse",
      correlationId: fetchReq.correlationId,
      changes: [],
      docId,
    });

    const changes = await fetchPromise;
    expect(changes).toHaveLength(0);
  });
});
