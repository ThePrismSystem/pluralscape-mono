import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlatformProvider, usePlatform } from "../PlatformProvider.js";

import type { PlatformContext } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncStorageAdapter, OfflineQueueAdapter } from "@pluralscape/sync/adapters";

const stubContext: PlatformContext = {
  capabilities: {
    hasSecureStorage: false,
    hasBiometric: false,
    hasBackgroundSync: false,
    hasNativeMemzero: false,
    storageBackend: "indexeddb",
  },
  storage: {
    backend: "indexeddb",
    storageAdapter: {} as SyncStorageAdapter,
    offlineQueueAdapter: {} as OfflineQueueAdapter,
  },
  crypto: {
    init: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    constants: {} as SodiumAdapter["constants"],
    supportsSecureMemzero: false,
    aeadEncrypt: vi.fn(),
    aeadDecrypt: vi.fn(),
    aeadKeygen: vi.fn(),
    boxKeypair: vi.fn(),
    boxSeedKeypair: vi.fn(),
    boxEasy: vi.fn(),
    boxOpenEasy: vi.fn(),
    signKeypair: vi.fn(),
    signSeedKeypair: vi.fn(),
    signDetached: vi.fn(),
    signVerifyDetached: vi.fn(),
    pwhash: vi.fn(),
    pwhashStr: vi.fn(),
    pwhashStrVerify: vi.fn(),
    kdfDeriveFromKey: vi.fn(),
    kdfKeygen: vi.fn(),
    genericHash: vi.fn(),
    randomBytes: vi.fn(),
    memzero: vi.fn(),
  },
};

describe("PlatformProvider", () => {
  it("provides platform context to children", () => {
    let captured: PlatformContext | null = null;

    function Consumer(): React.JSX.Element {
      captured = usePlatform();
      return <span>ok</span>;
    }

    renderToString(
      <PlatformProvider context={stubContext}>
        <Consumer />
      </PlatformProvider>,
    );

    expect(captured).toBe(stubContext);
    expect(captured?.capabilities.storageBackend).toBe("indexeddb");
  });

  it("throws when used outside provider", () => {
    function BadConsumer(): React.JSX.Element {
      usePlatform();
      return <span>bad</span>;
    }

    expect(() => {
      renderToString(<BadConsumer />);
    }).toThrow("usePlatform must be used within PlatformProvider");
  });
});
