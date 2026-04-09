import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

// ── Tests ────────────────────────────────────────────────────────────

describe("createMobilePersister (skeleton)", () => {
  it("seeds the IdTranslationTable with preload hints", () => {
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api: makeTestPersisterApi(),
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [
        { sourceEntityType: "member", sourceEntityId: "sp_1", pluralscapeEntityId: "mem_a" },
      ],
    });
    expect(persister).toBeDefined();
  });

  it("throws 'dispatch not implemented' from upsertEntity before Task 16 wiring", async () => {
    const persister = createMobilePersister({
      systemId: TEST_SYSTEM_ID,
      source: "simply-plural",
      masterKey: TEST_MASTER_KEY,
      api: makeTestPersisterApi(),
      avatarFetcher: NOOP_AVATAR_FETCHER,
      preloadHints: [],
    });

    await expect(
      persister.upsertEntity({
        entityType: "member",
        sourceEntityId: "sp_1",
        source: "simply-plural",
        payload: { name: "Aurora" },
      }),
    ).rejects.toThrow(/dispatch not implemented for member/);
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

    await persister.recordError(err);
    const drained = persister.drainErrors();
    expect(drained).toHaveLength(1);
    expect(drained[0]).toEqual(err);
    expect(persister.drainErrors()).toHaveLength(0);
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
