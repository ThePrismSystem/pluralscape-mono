import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptSnapshot, decryptSnapshotPage, encryptSnapshotInput } from "../snapshot.js";

import { makeBase64Blob } from "./helpers.js";

import type { SnapshotRaw } from "../snapshot.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SnapshotContent, SystemSnapshotId, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);

function makeSnapshotContent(): SnapshotContent {
  return {
    name: "Test Snapshot",
    description: null,
    members: [],
    structureEntityTypes: [],
    structureEntities: [],
    structureEntityLinks: [],
    structureEntityMemberLinks: [],
    structureEntityAssociations: [],
    relationships: [],
    groups: [],
    innerworldRegions: [],
    innerworldEntities: [],
  };
}

function makeRawSnapshot(overrides?: Partial<SnapshotRaw>): SnapshotRaw {
  return {
    id: brandId<SystemSnapshotId>("snap_001"),
    systemId: brandId<SystemId>("sys_test"),
    snapshotTrigger: "manual",
    createdAt: NOW,
    encryptedData: encryptAndEncodeT1(makeSnapshotContent(), masterKey),
    ...overrides,
  };
}

describe("decryptSnapshot", () => {
  it("decrypts snapshot content correctly", () => {
    const result = decryptSnapshot(makeRawSnapshot(), masterKey);

    expect(result.id).toBe("snap_001");
    expect(result.snapshotTrigger).toBe("manual");
    expect(result.content.name).toBe("Test Snapshot");
    expect(result.content.members).toEqual([]);
    expect(result.content.groups).toEqual([]);
  });

  it("throws on corrupted data", () => {
    const raw = makeRawSnapshot({ encryptedData: "not-valid!!!" });
    expect(() => decryptSnapshot(raw, masterKey)).toThrow();
  });
});

describe("decryptSnapshotPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = { data: [makeRawSnapshot(), makeRawSnapshot()], nextCursor: "cursor_abc" };
    const result = decryptSnapshotPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptSnapshotPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptSnapshotInput", () => {
  it("round-trips through decrypt", () => {
    const content = makeSnapshotContent();
    const { encryptedData } = encryptSnapshotInput(content, masterKey);
    const raw = makeRawSnapshot({ encryptedData });
    const result = decryptSnapshot(raw, masterKey);
    expect(result.content.name).toBe(content.name);
    expect(result.content.members).toEqual(content.members);
  });
});

describe("assertSnapshotContent", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRawSnapshot({ encryptedData: makeBase64Blob("string", masterKey) });
    expect(() => decryptSnapshot(raw, masterKey)).toThrow("not an object");
  });

  it("throws when members array is missing", () => {
    const raw = makeRawSnapshot({
      encryptedData: makeBase64Blob({ groups: [] }, masterKey),
    });
    expect(() => decryptSnapshot(raw, masterKey)).toThrow("members");
  });

  it("throws when groups array is missing", () => {
    const raw = makeRawSnapshot({
      encryptedData: makeBase64Blob({ members: [] }, masterKey),
    });
    expect(() => decryptSnapshot(raw, masterKey)).toThrow("groups");
  });
});
