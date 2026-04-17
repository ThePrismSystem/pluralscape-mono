import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptGroup, decryptGroupPage, encryptGroupInput, encryptGroupUpdate } from "../group.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { GroupId, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

interface RawGroup {
  id: GroupId;
  systemId: SystemId;
  parentGroupId: GroupId | null;
  sortOrder: number;
  encryptedData: string;
  version: number;
  createdAt: UnixMillis;
  updatedAt: UnixMillis;
  archived: boolean;
  archivedAt: UnixMillis | null;
}

function makeRawGroup(overrides?: Partial<RawGroup>): RawGroup {
  const encrypted = encryptAndEncodeT1(
    {
      name: "Test Group",
      description: "A test group",
      imageSource: null,
      color: "#ff0000",
      emoji: "🌟",
    },
    masterKey,
  );
  return {
    id: brandId<GroupId>("grp_01abc"),
    systemId: brandId<SystemId>("sys_01abc"),
    parentGroupId: null,
    sortOrder: 1,
    encryptedData: encrypted,
    version: 3,
    createdAt: 1_700_000_000_000 as UnixMillis,
    updatedAt: 1_700_001_000_000 as UnixMillis,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("decryptGroup", () => {
  it("merges encrypted fields with T3 passthrough fields", () => {
    const raw = makeRawGroup();
    const group = decryptGroup(raw, masterKey);

    expect(group.id).toBe("grp_01abc");
    expect(group.systemId).toBe("sys_01abc");
    expect(group.parentGroupId).toBeNull();
    expect(group.sortOrder).toBe(1);
    expect(group.version).toBe(3);
    expect(group.createdAt).toBe(1_700_000_000_000);
    expect(group.updatedAt).toBe(1_700_001_000_000);
    expect(group.archived).toBe(false);
    expect(group.name).toBe("Test Group");
    expect(group.description).toBe("A test group");
    expect(group.imageSource).toBeNull();
    expect(group.color).toBe("#ff0000");
    expect(group.emoji).toBe("🌟");
  });

  it("handles null optional encrypted fields", () => {
    const encrypted = encryptAndEncodeT1(
      {
        name: "Minimal Group",
        description: null,
        imageSource: null,
        color: null,
        emoji: null,
      },
      masterKey,
    );
    const raw = makeRawGroup({ encryptedData: encrypted });
    const group = decryptGroup(raw, masterKey);

    expect(group.name).toBe("Minimal Group");
    expect(group.description).toBeNull();
    expect(group.imageSource).toBeNull();
    expect(group.color).toBeNull();
    expect(group.emoji).toBeNull();
  });

  it("preserves parentGroupId when set", () => {
    const raw = makeRawGroup({ parentGroupId: brandId<GroupId>("grp_parent") });
    const group = decryptGroup(raw, masterKey);
    expect(group.parentGroupId).toBe("grp_parent");
  });

  it("throws when encrypted blob is missing required name field", () => {
    const encrypted = encryptAndEncodeT1(
      { description: null, imageSource: null, color: null, emoji: null },
      masterKey,
    );
    const raw = makeRawGroup({ encryptedData: encrypted });
    expect(() => decryptGroup(raw, masterKey)).toThrow("missing required string field: name");
  });

  it("throws when encrypted blob is not an object", () => {
    const encrypted = encryptAndEncodeT1("not-an-object", masterKey);
    const raw = makeRawGroup({ encryptedData: encrypted });
    expect(() => decryptGroup(raw, masterKey)).toThrow("not an object");
  });

  it("throws when imageSource is a non-object, non-null value", () => {
    const encrypted = encryptAndEncodeT1(
      { name: "Test", description: null, imageSource: "not-an-object", color: null, emoji: null },
      masterKey,
    );
    const raw = makeRawGroup({ encryptedData: encrypted });
    expect(() => decryptGroup(raw, masterKey)).toThrow("imageSource must be object or null");
  });
});

describe("decryptGroupPage", () => {
  it("decrypts all items and preserves nextCursor", () => {
    const raw1 = makeRawGroup();
    const raw2 = makeRawGroup({ id: brandId<GroupId>("grp_02xyz"), sortOrder: 2 });
    const page = decryptGroupPage({ data: [raw1, raw2], nextCursor: "cursor_abc" }, masterKey);

    expect(page.data).toHaveLength(2);
    const [first, second] = page.data;
    expect(first?.id).toBe("grp_01abc");
    expect(second?.id).toBe("grp_02xyz");
    expect(page.nextCursor).toBe("cursor_abc");
  });

  it("returns null nextCursor when no more pages", () => {
    const page = decryptGroupPage({ data: [makeRawGroup()], nextCursor: null }, masterKey);
    expect(page.nextCursor).toBeNull();
  });

  it("returns empty data for empty page", () => {
    const page = decryptGroupPage({ data: [], nextCursor: null }, masterKey);
    expect(page.data).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });
});

describe("encryptGroupInput", () => {
  it("encrypts input and returns encryptedData string", () => {
    const result = encryptGroupInput(
      {
        name: "New Group",
        description: "Some description",
        imageSource: null,
        color: "#abcdef" as import("@pluralscape/types").HexColor,
        emoji: null,
      },
      masterKey,
    );

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips encrypted fields back through decryptGroup", () => {
    const input = {
      name: "Round-trip Group",
      description: "Testing round-trip",
      imageSource: null,
      color: "#123456" as import("@pluralscape/types").HexColor,
      emoji: "🎯",
    };
    const { encryptedData } = encryptGroupInput(input, masterKey);
    const raw = makeRawGroup({ encryptedData });
    const group = decryptGroup(raw, masterKey);

    expect(group.name).toBe(input.name);
    expect(group.description).toBe(input.description);
    expect(group.color).toBe(input.color);
    expect(group.emoji).toBe(input.emoji);
  });

  it("handles null fields in round-trip", () => {
    const input = {
      name: "Null Fields Group",
      description: null,
      imageSource: null,
      color: null,
      emoji: null,
    };
    const { encryptedData } = encryptGroupInput(input, masterKey);
    const raw = makeRawGroup({ encryptedData });
    const group = decryptGroup(raw, masterKey);

    expect(group.name).toBe("Null Fields Group");
    expect(group.description).toBeNull();
    expect(group.color).toBeNull();
    expect(group.emoji).toBeNull();
  });
});

describe("encryptGroupUpdate", () => {
  it("returns encryptedData and version", () => {
    const result = encryptGroupUpdate(
      {
        name: "Updated Group",
        description: null,
        imageSource: null,
        color: null,
        emoji: null,
      },
      7,
      masterKey,
    );

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(7);
  });

  it("round-trips update encrypted fields", () => {
    const input = {
      name: "Updated Name",
      description: "Updated desc",
      imageSource: null,
      color: "#ffffff" as import("@pluralscape/types").HexColor,
      emoji: "✨",
    };
    const { encryptedData } = encryptGroupUpdate(input, 2, masterKey);
    const raw = makeRawGroup({ encryptedData });
    const group = decryptGroup(raw, masterKey);

    expect(group.name).toBe("Updated Name");
    expect(group.description).toBe("Updated desc");
    expect(group.color).toBe("#ffffff");
    expect(group.emoji).toBe("✨");
  });
});
