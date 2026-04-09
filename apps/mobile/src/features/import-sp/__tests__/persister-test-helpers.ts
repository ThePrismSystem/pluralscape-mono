/**
 * Shared test fixtures for the mobile-side SP persister tests.
 *
 * Centralises the `PersisterApi` mock factory, the master-key builder,
 * and a no-op avatar fetcher so each persister test file can stay focused
 * on its helper's behaviour.
 */

import { vi } from "vitest";

import type {
  IdTranslationTable,
  PersisterApi,
  PersisterContext,
} from "../persister/persister.types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type { ImportSource, SystemId } from "@pluralscape/types";

// ── Constants ────────────────────────────────────────────────────────

const MASTER_KEY_LENGTH = 32;
const MASTER_KEY_FILL_BYTE = 0xab;

export const TEST_SYSTEM_ID = "sys_persister_test" as SystemId;
export const TEST_SOURCE: ImportSource = "simply-plural";

// ── Master key helper ────────────────────────────────────────────────

/**
 * Build a deterministic 32-byte master key for encryption round trips in
 * tests. Uses an inner assertion function to brand the key without an
 * `as unknown as` cast.
 */
export function makeTestMasterKey(): KdfMasterKey {
  const raw = new Uint8Array(MASTER_KEY_LENGTH).fill(MASTER_KEY_FILL_BYTE);
  function assertKdfMasterKey(key: Uint8Array): asserts key is KdfMasterKey {
    if (key.length !== MASTER_KEY_LENGTH) {
      throw new Error("key must be 32 bytes");
    }
  }
  assertKdfMasterKey(raw);
  return raw;
}

// ── Id translation table ─────────────────────────────────────────────

export function makeTestIdTranslation(): IdTranslationTable {
  const store = new Map<string, string>();
  return {
    get(sourceEntityType, sourceEntityId) {
      return store.get(`${sourceEntityType}:${sourceEntityId}`) ?? null;
    },
    set(sourceEntityType, sourceEntityId, pluralscapeEntityId) {
      store.set(`${sourceEntityType}:${sourceEntityId}`, pluralscapeEntityId);
    },
  };
}

// ── Avatar fetcher ───────────────────────────────────────────────────

export const NOOP_AVATAR_FETCHER: AvatarFetcher = {
  fetchAvatar(): ReturnType<AvatarFetcher["fetchAvatar"]> {
    return Promise.resolve({ status: "not-found" });
  },
};

// ── PersisterApi mock factory ────────────────────────────────────────

/**
 * Build a fully-mocked `PersisterApi`. Every method is a `vi.fn` resolved
 * to a deterministic default so test files that do not care about the
 * specific procedure can just reuse the factory.
 */
export function makeTestPersisterApi(): PersisterApi {
  return {
    system: {
      getCurrentVersion: vi.fn<PersisterApi["system"]["getCurrentVersion"]>().mockResolvedValue(1),
      update: vi
        .fn<PersisterApi["system"]["update"]>()
        .mockResolvedValue({ id: "sys_1", version: 2 }),
    },
    systemSettings: {
      getCurrentVersion: vi
        .fn<PersisterApi["systemSettings"]["getCurrentVersion"]>()
        .mockResolvedValue(1),
      update: vi
        .fn<PersisterApi["systemSettings"]["update"]>()
        .mockResolvedValue({ id: "sset_1", version: 2 }),
    },
    bucket: {
      create: vi
        .fn<PersisterApi["bucket"]["create"]>()
        .mockResolvedValue({ id: "bkt_1", version: 1 }),
      update: vi
        .fn<PersisterApi["bucket"]["update"]>()
        .mockResolvedValue({ id: "bkt_1", version: 2 }),
    },
    field: {
      create: vi
        .fn<PersisterApi["field"]["create"]>()
        .mockResolvedValue({ id: "fld_1", version: 1 }),
      update: vi
        .fn<PersisterApi["field"]["update"]>()
        .mockResolvedValue({ id: "fld_1", version: 2 }),
      setValue: vi
        .fn<PersisterApi["field"]["setValue"]>()
        .mockResolvedValue({ id: "fv_1", version: 1 }),
    },
    customFront: {
      create: vi
        .fn<PersisterApi["customFront"]["create"]>()
        .mockResolvedValue({ id: "cf_1", version: 1 }),
      update: vi
        .fn<PersisterApi["customFront"]["update"]>()
        .mockResolvedValue({ id: "cf_1", version: 2 }),
    },
    member: {
      create: vi
        .fn<PersisterApi["member"]["create"]>()
        .mockResolvedValue({ id: "mem_1", version: 1 }),
      update: vi
        .fn<PersisterApi["member"]["update"]>()
        .mockResolvedValue({ id: "mem_1", version: 2 }),
    },
    friend: {
      recordExternalReference: vi
        .fn<PersisterApi["friend"]["recordExternalReference"]>()
        .mockResolvedValue({ placeholderId: "fc_placeholder" }),
    },
    frontingSession: {
      create: vi
        .fn<PersisterApi["frontingSession"]["create"]>()
        .mockResolvedValue({ id: "fs_1", version: 1 }),
      update: vi
        .fn<PersisterApi["frontingSession"]["update"]>()
        .mockResolvedValue({ id: "fs_1", version: 2 }),
    },
    frontingComment: {
      create: vi
        .fn<PersisterApi["frontingComment"]["create"]>()
        .mockResolvedValue({ id: "fcom_1", version: 1 }),
      update: vi
        .fn<PersisterApi["frontingComment"]["update"]>()
        .mockResolvedValue({ id: "fcom_1", version: 2 }),
    },
    note: {
      create: vi
        .fn<PersisterApi["note"]["create"]>()
        .mockResolvedValue({ id: "note_1", version: 1 }),
      update: vi
        .fn<PersisterApi["note"]["update"]>()
        .mockResolvedValue({ id: "note_1", version: 2 }),
    },
    poll: {
      create: vi
        .fn<PersisterApi["poll"]["create"]>()
        .mockResolvedValue({ id: "poll_1", version: 1 }),
      update: vi
        .fn<PersisterApi["poll"]["update"]>()
        .mockResolvedValue({ id: "poll_1", version: 2 }),
      castVote: vi.fn<PersisterApi["poll"]["castVote"]>().mockResolvedValue({ id: "pv_1" }),
    },
    channel: {
      create: vi
        .fn<PersisterApi["channel"]["create"]>()
        .mockResolvedValue({ id: "ch_1", version: 1 }),
      update: vi
        .fn<PersisterApi["channel"]["update"]>()
        .mockResolvedValue({ id: "ch_1", version: 2 }),
    },
    message: {
      create: vi
        .fn<PersisterApi["message"]["create"]>()
        .mockResolvedValue({ id: "msg_1", version: 1 }),
      update: vi
        .fn<PersisterApi["message"]["update"]>()
        .mockResolvedValue({ id: "msg_1", version: 2 }),
    },
    boardMessage: {
      create: vi
        .fn<PersisterApi["boardMessage"]["create"]>()
        .mockResolvedValue({ id: "bm_1", version: 1 }),
      update: vi
        .fn<PersisterApi["boardMessage"]["update"]>()
        .mockResolvedValue({ id: "bm_1", version: 2 }),
    },
    group: {
      create: vi
        .fn<PersisterApi["group"]["create"]>()
        .mockResolvedValue({ id: "grp_1", version: 1 }),
      update: vi
        .fn<PersisterApi["group"]["update"]>()
        .mockResolvedValue({ id: "grp_1", version: 2 }),
    },
    blob: {
      uploadAvatar: vi
        .fn<PersisterApi["blob"]["uploadAvatar"]>()
        .mockResolvedValue({ blobId: "blob_1" }),
    },
    importEntityRef: {
      lookupBatch: vi.fn<PersisterApi["importEntityRef"]["lookupBatch"]>().mockResolvedValue({}),
      upsertBatch: vi
        .fn<PersisterApi["importEntityRef"]["upsertBatch"]>()
        .mockResolvedValue({ upserted: 0 }),
    },
  };
}

// ── Persister context factory ────────────────────────────────────────

export interface MakeTestContextOverrides {
  readonly systemId?: SystemId;
  readonly source?: ImportSource;
  readonly masterKey?: KdfMasterKey;
  readonly api?: PersisterApi;
  readonly idTranslation?: IdTranslationTable;
  readonly avatarFetcher?: AvatarFetcher;
}

/**
 * Build a full `PersisterContext` suitable for driving any helper.
 *
 * Every collaborator is a `vi.fn` so individual tests can assert on
 * recorded calls without wiring their own scaffolding.
 */
export function makeTestPersisterContext(
  overrides: MakeTestContextOverrides = {},
): PersisterContext {
  return {
    systemId: overrides.systemId ?? TEST_SYSTEM_ID,
    source: overrides.source ?? TEST_SOURCE,
    masterKey: overrides.masterKey ?? makeTestMasterKey(),
    api: overrides.api ?? makeTestPersisterApi(),
    idTranslation: overrides.idTranslation ?? makeTestIdTranslation(),
    avatarFetcher: overrides.avatarFetcher ?? NOOP_AVATAR_FETCHER,
    recordError: vi.fn(),
    queueRefUpsert: vi.fn(),
  };
}
