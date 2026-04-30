import {
  configureSodium,
  createBucketKeyCache,
  generateIdentityKeypair,
  generateMasterKey,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { vi } from "vitest";

import { DocumentKeyResolver } from "../../document-key-resolver.js";
import { SyncEngine } from "../../engine/sync-engine.js";
import { EncryptedRelay } from "../../relay.js";
import { asSyncDocId, sysId } from "../test-crypto-helpers.js";

import type { SyncManifest, SyncNetworkAdapter } from "../../adapters/network-adapter.js";
import type { SyncStorageAdapter } from "../../adapters/storage-adapter.js";
import type { SyncEngineConfig } from "../../engine/sync-engine.js";
import type { EncryptedChangeEnvelope } from "../../types.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";

/**
 * Shared fixtures for sync-engine-runtime-hardening test files.
 *
 * Tests share a process-wide sodium adapter, master key, signing keys, and
 * bucket key cache. Each split test file calls `setupHardeningEnv()` from a
 * `beforeAll` and `teardownHardeningEnv()` from `afterAll`.
 */

interface HardeningEnv {
  sodium: SodiumAdapter;
  masterKey: KdfMasterKey;
  signingKeys: SignKeypair;
  bucketKeyCache: BucketKeyCache;
}

let env: HardeningEnv | null = null;

/** Initializes shared crypto resources. Idempotent across test files. */
export async function setupHardeningEnv(): Promise<HardeningEnv> {
  if (env !== null) return env;

  const sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  const masterKey = generateMasterKey();
  const identity = generateIdentityKeypair(masterKey);
  const signingKeys = identity.signing;
  const bucketKeyCache = createBucketKeyCache();

  env = { sodium, masterKey, signingKeys, bucketKeyCache };
  return env;
}

/** Releases shared crypto resources. Tests should call from `afterAll`. */
export function teardownHardeningEnv(): void {
  if (env === null) return;
  env.bucketKeyCache.clearAll();
  env.sodium.memzero(env.signingKeys.secretKey);
  env.sodium.memzero(env.masterKey);
  env = null;
}

/** Default manifest with one system-core document at version 0. */
export const SYSTEM_CORE_MANIFEST: SyncManifest = {
  systemId: sysId("sys_test"),
  documents: [
    {
      docId: asSyncDocId("system-core-sys_test"),
      docType: "system-core",
      keyType: "derived",
      bucketId: null,
      channelId: null,
      timePeriod: null,
      createdAt: toUnixMillis(1000),
      updatedAt: toUnixMillis(1000),
      sizeBytes: 0,
      snapshotVersion: 0,
      lastSeq: 0,
      archived: false,
    },
  ],
};

/** Creates a DocumentKeyResolver bound to the shared crypto resources. */
export function createKeyResolver(currentEnv: HardeningEnv): DocumentKeyResolver {
  return DocumentKeyResolver.create({
    masterKey: currentEnv.masterKey,
    signingKeys: currentEnv.signingKeys,
    bucketKeyCache: currentEnv.bucketKeyCache,
    sodium: currentEnv.sodium,
  });
}

/** Returns a SyncStorageAdapter pre-populated with vi.fn() mocks plus optional overrides. */
export function mockStorageAdapter(
  overrides: Partial<SyncStorageAdapter> = {},
): SyncStorageAdapter {
  return {
    loadSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    loadChangesSince: vi.fn().mockResolvedValue([]),
    appendChange: vi.fn().mockResolvedValue(undefined),
    pruneChangesBeforeSnapshot: vi.fn().mockResolvedValue(undefined),
    listDocuments: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Builds a SyncNetworkAdapter that delegates submit/fetch to an in-process relay. */
export function relayNetworkAdapter(relay: EncryptedRelay): SyncNetworkAdapter {
  return {
    submitChange: vi
      .fn()
      .mockImplementation((_docId: string, change: Omit<EncryptedChangeEnvelope, "seq">) => {
        const seq = relay.submit(change);
        return Promise.resolve({ ...change, seq });
      }),
    fetchChangesSince: vi.fn().mockImplementation((rawDocId: string, sinceSeq: number) => {
      return Promise.resolve(relay.getEnvelopesSince(asSyncDocId(rawDocId), sinceSeq));
    }),
    submitSnapshot: vi.fn().mockResolvedValue(undefined),
    fetchLatestSnapshot: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    fetchManifest: vi.fn().mockResolvedValue(SYSTEM_CORE_MANIFEST),
  };
}

/** Constructs a SyncEngine, calls bootstrap(), and returns it. */
export async function createBootstrappedEngine(
  currentEnv: HardeningEnv,
  overrides: Partial<SyncEngineConfig> = {},
): Promise<SyncEngine> {
  const relay = new EncryptedRelay();
  const engine = new SyncEngine({
    networkAdapter: relayNetworkAdapter(relay),
    storageAdapter: mockStorageAdapter(),
    keyResolver: createKeyResolver(currentEnv),
    sodium: currentEnv.sodium,
    profile: { profileType: "owner-full" },
    systemId: sysId("sys_test"),
    onError: vi.fn(),
    ...overrides,
  });
  await engine.bootstrap();
  return engine;
}
