import { afterEach, describe, expect, it, vi } from "vitest";

import {
  asSyncDocId,
  asSystemId,
  createTestHarness,
  getLastMock,
  resetMockInstances,
} from "./helpers/ws-client-adapter-fixtures.js";

import type { EncryptedChangeEnvelope } from "../../types.js";

afterEach(() => {
  resetMockInstances();
});

describe("createWsClientAdapter — DocumentUpdate routing", () => {
  it("routes DocumentUpdate to subscription callbacks", () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-test-1");

    const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
    harness.adapter.subscribe(docId, (changes) => {
      received.push(changes);
    });

    const fakeChanges = [
      {
        ciphertext: Array.from(new Uint8Array([1, 2, 3])),
        nonce: Array.from(new Uint8Array(24).fill(0xaa)),
        signature: Array.from(new Uint8Array(64).fill(0xbb)),
        authorPublicKey: Array.from(new Uint8Array(32).fill(0xcc)),
        documentId: docId,
        seq: 1,
      },
    ];

    mock.simulateMessage({
      type: "DocumentUpdate",
      correlationId: null,
      docId,
      changes: fakeChanges,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(1);
  });

  it("does not deliver DocumentUpdate to unsubscribed callbacks", () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-test-2");

    const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
    const sub = harness.adapter.subscribe(docId, (changes) => {
      received.push(changes);
    });
    sub.unsubscribe();

    mock.simulateMessage({
      type: "DocumentUpdate",
      correlationId: null,
      docId,
      changes: [],
    });

    expect(received).toHaveLength(0);
  });

  it("subscriber errors do not break other subscribers", () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-resilient");

    const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
    harness.adapter.subscribe(docId, () => {
      throw new Error("subscriber boom");
    });
    harness.adapter.subscribe(docId, (changes) => {
      received.push(changes);
    });

    mock.simulateMessage({
      type: "DocumentUpdate",
      correlationId: null,
      docId,
      changes: [
        {
          ciphertext: [],
          nonce: [],
          signature: [],
          authorPublicKey: [],
          documentId: docId,
          seq: 5,
        },
      ],
    });

    expect(received).toHaveLength(1);
  });
});

describe("createWsClientAdapter — request/response correlation", () => {
  it("resolves fetchManifest with correlated response", async () => {
    const harness = createTestHarness();
    const mock = harness.connectAndAuth();

    const manifestPromise = harness.adapter.fetchManifest(asSystemId("sys_test123"));

    // Allow the authReady microtask to flush so the request is sent
    await vi.waitFor(() => {
      const req = mock.sentMessages.find((m) => (m as { type: string }).type === "ManifestRequest");
      expect(req).not.toBeUndefined();
    });

    const manifestReq = mock.sentMessages.find(
      (m) => (m as { type: string }).type === "ManifestRequest",
    ) as { correlationId: string };

    mock.simulateMessage({
      type: "ManifestResponse",
      correlationId: manifestReq.correlationId,
      manifest: {
        systemId: "sys_test123",
        documents: [],
      },
    });

    const manifest = await manifestPromise;
    expect(manifest.systemId).toBe("sys_test123");
    expect(manifest.documents).toHaveLength(0);
  });

  it("rejects requests after disconnect with AdapterDisposedError", async () => {
    const harness = createTestHarness();
    harness.connectAndAuth();
    harness.adapter.disconnect();

    await expect(harness.adapter.fetchManifest(asSystemId("sys_test"))).rejects.toThrow(
      "Adapter disposed",
    );
  });
});

describe("createWsClientAdapter — error emission", () => {
  it("emits sync:error when a DocumentUpdate subscriber throws", () => {
    const harness = createTestHarness();
    const errors: { message: string }[] = [];
    harness.eventBus.on("sync:error", (event) => errors.push(event));

    const mock = harness.connectAndAuth();
    const docId = asSyncDocId("doc-err");

    harness.adapter.subscribe(docId, () => {
      throw new Error("subscriber kaboom");
    });

    mock.simulateMessage({
      type: "DocumentUpdate",
      correlationId: null,
      docId,
      changes: [
        {
          ciphertext: [],
          nonce: [],
          signature: [],
          authorPublicKey: [],
          documentId: docId,
          seq: 1,
        },
      ],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("DocumentUpdate subscriber error");
  });

  it("emits sync:error on malformed WebSocket message", () => {
    const harness = createTestHarness();
    const errors: { message: string }[] = [];
    harness.eventBus.on("sync:error", (event) => errors.push(event));

    harness.adapter.connect();
    const mock = getLastMock();
    mock.simulateOpen();

    // Send invalid JSON
    const rawEvent = { data: "not-valid-json{{{" } as MessageEvent;
    mock.onmessage?.(rawEvent);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("Failed to parse");
  });
});
