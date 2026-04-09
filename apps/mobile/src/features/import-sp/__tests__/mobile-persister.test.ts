import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PERSISTER_REF_BATCH_SIZE } from "../import-sp-mobile.constants.js";
import { createMobilePersister } from "../mobile-persister.js";

import {
  NOOP_AVATAR_FETCHER,
  TEST_SYSTEM_ID,
  makeTestMasterKey,
  makeTestPersisterApi,
} from "./persister-test-helpers.js";

import type { PersisterApi } from "../persister/persister.types.js";
import type { ImportError } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const TEST_MASTER_KEY = makeTestMasterKey();

const PRIVACY_BUCKET_PAYLOAD = {
  name: "Trusted",
  description: "visible to trusted friends",
  color: null,
  icon: null,
};

// ── Construction + skeleton behaviours ──────────────────────────────

describe("createMobilePersister — construction", () => {
  it("seeds the IdTranslationTable with preload hints so a pre-mapped entity updates on upsert", async () => {
    const api = makeTestPersisterApi();
    const bucketCreate = vi.mocked(api.bucket.create);
    const bucketUpdate = vi.mocked(api.bucket.update);
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [
        {
          sourceEntityType: "privacy-bucket",
          sourceEntityId: "sp_bkt_1",
          pluralscapeEntityId: "bkt_preloaded",
        },
      ],
    });

    await persister.upsertEntity({
      entityType: "privacy-bucket",
      sourceEntityId: "sp_bkt_1",
      source: "simply-plural",
      payload: PRIVACY_BUCKET_PAYLOAD,
    });

    expect(bucketCreate).not.toHaveBeenCalled();
    expect(bucketUpdate).toHaveBeenCalledTimes(1);
    expect(bucketUpdate.mock.calls[0]?.[1]).toBe("bkt_preloaded");
  });

  it("records errors via recordError and drains them", async () => {
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api: makeTestPersisterApi(),
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const err: ImportError = {
      entityType: "member",
      entityId: "sp_1",
      message: "test failure",
      fatal: false,
      recoverable: false,
    };

    for (let i = 0; i < 10; i += 1) {
      await persister.recordError(err);
    }
    const drained = persister.drainErrors();
    expect(drained).toHaveLength(10);
    expect(persister.drainErrors()).toHaveLength(0);
  });
});

// ── Dispatch wiring ─────────────────────────────────────────────────

describe("createMobilePersister — dispatch wiring", () => {
  it("routes a first-time source ID through the helper's create path", async () => {
    const api = makeTestPersisterApi();
    const bucketCreate = vi.mocked(api.bucket.create);
    const bucketUpdate = vi.mocked(api.bucket.update);
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    const result = await persister.upsertEntity({
      entityType: "privacy-bucket",
      sourceEntityId: "sp_bkt_1",
      source: "simply-plural",
      payload: PRIVACY_BUCKET_PAYLOAD,
    });

    expect(bucketCreate).toHaveBeenCalledTimes(1);
    expect(bucketUpdate).not.toHaveBeenCalled();
    expect(result.action).toBe("created");
    expect(result.pluralscapeEntityId).toBe("bkt_1");
  });

  it("second call with the same source ID routes through update", async () => {
    const api = makeTestPersisterApi();
    const bucketCreate = vi.mocked(api.bucket.create);
    const bucketUpdate = vi.mocked(api.bucket.update);
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    await persister.upsertEntity({
      entityType: "privacy-bucket",
      sourceEntityId: "sp_bkt_1",
      source: "simply-plural",
      payload: PRIVACY_BUCKET_PAYLOAD,
    });
    const second = await persister.upsertEntity({
      entityType: "privacy-bucket",
      sourceEntityId: "sp_bkt_1",
      source: "simply-plural",
      payload: PRIVACY_BUCKET_PAYLOAD,
    });

    expect(bucketCreate).toHaveBeenCalledTimes(1);
    expect(bucketUpdate).toHaveBeenCalledTimes(1);
    expect(bucketUpdate.mock.calls[0]?.[1]).toBe("bkt_1");
    expect(second.action).toBe("updated");
  });
});

// ── Batched ref upsert ──────────────────────────────────────────────

describe("createMobilePersister — batched ref upsert", () => {
  it("flushes the ref queue at PERSISTER_REF_BATCH_SIZE and drains the remainder on flush()", async () => {
    // Each successive create call returns a unique Pluralscape ID so the
    // translation table does not de-duplicate them into a single ref.
    const uniqueCreate = vi.fn<PersisterApi["bucket"]["create"]>();
    for (let i = 0; i < PERSISTER_REF_BATCH_SIZE + 1; i += 1) {
      uniqueCreate.mockResolvedValueOnce({ id: `bkt_${String(i)}`, version: 1 });
    }
    const baseApi = makeTestPersisterApi();
    const upsertBatch = vi
      .fn<PersisterApi["importEntityRef"]["upsertBatch"]>()
      .mockResolvedValue({ upserted: PERSISTER_REF_BATCH_SIZE });
    const api: PersisterApi = {
      ...baseApi,
      bucket: { ...baseApi.bucket, create: uniqueCreate },
      importEntityRef: {
        lookupBatch: vi.fn<PersisterApi["importEntityRef"]["lookupBatch"]>().mockResolvedValue({}),
        upsertBatch,
      },
    };

    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    for (let i = 0; i < PERSISTER_REF_BATCH_SIZE + 1; i += 1) {
      await persister.upsertEntity({
        entityType: "privacy-bucket",
        sourceEntityId: `sp_bkt_${String(i)}`,
        source: "simply-plural",
        payload: PRIVACY_BUCKET_PAYLOAD,
      });
    }

    // After the 50th upsert the queue hit the threshold and flushed once.
    expect(upsertBatch).toHaveBeenCalledTimes(1);
    const firstCall = upsertBatch.mock.calls[0];
    expect(firstCall?.[1].refs).toHaveLength(PERSISTER_REF_BATCH_SIZE);

    await persister.flush();

    // Flush drains the final enqueued ref.
    expect(upsertBatch).toHaveBeenCalledTimes(2);
    const secondCall = upsertBatch.mock.calls[1];
    expect(secondCall?.[1].refs).toHaveLength(1);
  });

  it("flush is a no-op when the ref queue is empty", async () => {
    const upsertBatch = vi
      .fn<PersisterApi["importEntityRef"]["upsertBatch"]>()
      .mockResolvedValue({ upserted: 0 });
    const api: PersisterApi = {
      ...makeTestPersisterApi(),
      importEntityRef: {
        lookupBatch: vi.fn<PersisterApi["importEntityRef"]["lookupBatch"]>().mockResolvedValue({}),
        upsertBatch,
      },
    };
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api,
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    await persister.flush();
    expect(upsertBatch).not.toHaveBeenCalled();
  });
});
