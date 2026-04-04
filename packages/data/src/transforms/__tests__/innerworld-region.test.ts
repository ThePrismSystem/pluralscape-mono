import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptInnerWorldRegion,
  decryptInnerWorldRegionPage,
  encryptInnerWorldRegionInput,
  encryptInnerWorldRegionUpdate,
} from "../innerworld-region.js";

import { makeBase64Blob } from "./helpers.js";

import type { InnerWorldRegionEncryptedFields, InnerWorldRegionRaw } from "../innerworld-region.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { InnerWorldRegionId, MemberId, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const NOW = toUnixMillis(1_700_000_000_000);

function makeRegionFields(): InnerWorldRegionEncryptedFields {
  return {
    name: "Safe Haven",
    description: "A peaceful region",
    boundaryData: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    visual: {
      color: "#00ff00",
      icon: null,
      size: null,
      opacity: null,
      imageSource: null,
      externalUrl: null,
    },
    gatekeeperMemberIds: ["mem_1" as MemberId],
    accessType: "gatekept",
  };
}

function makeRawRegion(overrides?: Partial<InnerWorldRegionRaw>): InnerWorldRegionRaw {
  return {
    id: "reg_001" as InnerWorldRegionId,
    systemId: "sys_test" as SystemId,
    parentRegionId: null,
    encryptedData: encryptAndEncodeT1(makeRegionFields(), masterKey),
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("decryptInnerWorldRegion", () => {
  it("decrypts all fields correctly", () => {
    const result = decryptInnerWorldRegion(makeRawRegion(), masterKey);

    expect(result.name).toBe("Safe Haven");
    expect(result.description).toBe("A peaceful region");
    expect(result.boundaryData).toHaveLength(3);
    expect(result.gatekeeperMemberIds).toEqual(["mem_1"]);
    expect(result.accessType).toBe("gatekept");
    expect(result.archived).toBe(false);
  });

  it("handles open access type", () => {
    const fields = { ...makeRegionFields(), accessType: "open" as const, gatekeeperMemberIds: [] };
    const raw = makeRawRegion({ encryptedData: encryptAndEncodeT1(fields, masterKey) });
    const result = decryptInnerWorldRegion(raw, masterKey);
    expect(result.accessType).toBe("open");
    expect(result.gatekeeperMemberIds).toEqual([]);
  });

  it("returns archived variant with archivedAt", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeRawRegion({ archived: true, archivedAt });
    const result = decryptInnerWorldRegion(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeRawRegion({ archived: true, archivedAt: null });
    expect(() => decryptInnerWorldRegion(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("handles null description", () => {
    const fields = { ...makeRegionFields(), description: null };
    const raw = makeRawRegion({ encryptedData: encryptAndEncodeT1(fields, masterKey) });
    const result = decryptInnerWorldRegion(raw, masterKey);
    expect(result.description).toBeNull();
  });

  it("passes through parentRegionId", () => {
    const raw = makeRawRegion({ parentRegionId: "reg_parent" as InnerWorldRegionId });
    const result = decryptInnerWorldRegion(raw, masterKey);
    expect(result.parentRegionId).toBe("reg_parent");
  });
});

describe("decryptInnerWorldRegionPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = { data: [makeRawRegion(), makeRawRegion()], nextCursor: "cursor_abc" };
    const result = decryptInnerWorldRegionPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptInnerWorldRegionPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptInnerWorldRegionInput", () => {
  it("round-trips through decrypt", () => {
    const fields = makeRegionFields();
    const { encryptedData } = encryptInnerWorldRegionInput(fields, masterKey);
    const raw = makeRawRegion({ encryptedData });
    const result = decryptInnerWorldRegion(raw, masterKey);
    expect(result.name).toBe(fields.name);
    expect(result.accessType).toBe(fields.accessType);
  });
});

describe("encryptInnerWorldRegionUpdate", () => {
  it("includes version", () => {
    const result = encryptInnerWorldRegionUpdate(makeRegionFields(), 4, masterKey);
    expect(result.version).toBe(4);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("assertInnerWorldRegionEncryptedFields", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRawRegion({ encryptedData: makeBase64Blob("string", masterKey) });
    expect(() => decryptInnerWorldRegion(raw, masterKey)).toThrow("not an object");
  });

  it("throws when name is missing", () => {
    const raw = makeRawRegion({
      encryptedData: makeBase64Blob({ description: null }, masterKey),
    });
    expect(() => decryptInnerWorldRegion(raw, masterKey)).toThrow("name");
  });
});
