import { afterEach, describe, expect, it, vi } from "vitest";

import {
  asSyncDocId,
  createTestHarness,
  resetMockInstances,
} from "./helpers/ws-client-adapter-fixtures.js";

afterEach(() => {
  resetMockInstances();
});

describe("createWsClientAdapter — submitSnapshot", () => {
  it("resolves on SnapshotAccepted", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snapshot");

    const snapshot = {
      ciphertext: [9, 8, 7],
      nonce: Array.from(new Uint8Array(24).fill(1)),
      documentId: docId,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    const submitPromise = harness.adapter.submitSnapshot(docId, snapshot as never);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "SnapshotAccepted",
      correlationId: submitReq.correlationId,
      docId,
    });

    await expect(submitPromise).resolves.toBeUndefined();
  });

  it("silently returns on VERSION_CONFLICT SyncError", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snapshot-conflict");

    const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "SyncError",
      correlationId: submitReq.correlationId,
      code: "VERSION_CONFLICT",
      message: "conflict",
      docId,
    });

    await expect(submitPromise).resolves.toBeUndefined();
  });

  it("throws SyncProtocolError on non-VERSION_CONFLICT SyncError", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snapshot-auth-err");

    const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "SyncError",
      correlationId: submitReq.correlationId,
      code: "AUTH_FAILED",
      message: "unauthorized",
      docId,
    });

    await expect(submitPromise).rejects.toThrow("AUTH_FAILED");
  });

  it("throws UnexpectedResponseError on unexpected response type", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snapshot-unexpected");

    const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const submitReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "ManifestResponse",
      correlationId: submitReq.correlationId,
      manifest: { systemId: "sys_x", documents: [] },
    });

    await expect(submitPromise).rejects.toThrow("SnapshotAccepted");
  });
});

describe("createWsClientAdapter — fetchLatestSnapshot", () => {
  it("returns snapshot from response", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snap-fetch");

    const fetchPromise = harness.adapter.fetchLatestSnapshot(docId);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const fetchReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "FetchSnapshotRequest",
    ) as { correlationId: string };

    const fakeSnapshot = {
      ciphertext: [1],
      nonce: [2],
      documentId: docId,
      version: 3,
      createdAt: new Date().toISOString(),
    };

    mock.simulateMessage({
      type: "SnapshotResponse",
      correlationId: fetchReq.correlationId,
      snapshot: fakeSnapshot,
      docId,
    });

    const result = await fetchPromise;
    expect(result).not.toBeNull();
  });

  it("returns null when snapshot is null", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-snap-null");

    const fetchPromise = harness.adapter.fetchLatestSnapshot(docId);

    await vi.waitFor(() => {
      const req = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchSnapshotRequest",
      );
      expect(req).not.toBeUndefined();
    });

    const fetchReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "FetchSnapshotRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "SnapshotResponse",
      correlationId: fetchReq.correlationId,
      snapshot: null,
      docId,
    });

    const result = await fetchPromise;
    expect(result).toBeNull();
  });
});
