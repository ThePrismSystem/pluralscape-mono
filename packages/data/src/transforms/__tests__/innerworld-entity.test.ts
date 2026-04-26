import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptInnerWorldEntity,
  decryptInnerWorldEntityPage,
  encryptInnerWorldEntityInput,
  encryptInnerWorldEntityUpdate,
} from "../innerworld-entity.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  InnerWorldEntityEncryptedInput,
  InnerWorldEntityId,
  InnerWorldEntityWire,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  VisualProperties,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

const VISUAL: VisualProperties = {
  color: null,
  icon: null,
  size: null,
  opacity: null,
  imageSource: null,
  externalUrl: null,
};
const NOW = toUnixMillis(1_700_000_000_000);

function makeMemberPayload(): InnerWorldEntityEncryptedInput {
  return {
    entityType: "member",
    positionX: 10,
    positionY: 20,
    visual: VISUAL,
    linkedMemberId: brandId<MemberId>("mem_abc"),
  };
}

function makeLandmarkPayload(): InnerWorldEntityEncryptedInput {
  return {
    entityType: "landmark",
    positionX: 30,
    positionY: 40,
    visual: VISUAL,
    name: "The Lake",
    description: "A serene lake",
  };
}

function makeStructureEntityPayload(): InnerWorldEntityEncryptedInput {
  return {
    entityType: "structure-entity",
    positionX: 50,
    positionY: 60,
    visual: VISUAL,
    linkedStructureEntityId: brandId<SystemStructureEntityId>("se_xyz"),
  };
}

function makeRaw(
  payload: InnerWorldEntityEncryptedInput,
  overrides?: Partial<InnerWorldEntityWire>,
): InnerWorldEntityWire {
  return {
    id: brandId<InnerWorldEntityId>("iwe_001"),
    systemId: brandId<SystemId>("sys_test"),
    regionId: brandId<InnerWorldRegionId>("reg_001"),
    encryptedData: encryptAndEncodeT1(payload, masterKey),
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("decryptInnerWorldEntity", () => {
  it("decrypts member variant", () => {
    const result = decryptInnerWorldEntity(makeRaw(makeMemberPayload()), masterKey);
    expect(result.entityType).toBe("member");
    if (result.entityType === "member") {
      expect(result.linkedMemberId).toBe("mem_abc");
    }
    expect(result.positionX).toBe(10);
    expect(result.positionY).toBe(20);
    expect(result.archived).toBe(false);
  });

  it("decrypts landmark variant", () => {
    const result = decryptInnerWorldEntity(makeRaw(makeLandmarkPayload()), masterKey);
    expect(result.entityType).toBe("landmark");
    if (result.entityType === "landmark") {
      expect(result.name).toBe("The Lake");
      expect(result.description).toBe("A serene lake");
    }
  });

  it("decrypts landmark with null description", () => {
    const payload = { ...makeLandmarkPayload(), description: null };
    const result = decryptInnerWorldEntity(makeRaw(payload), masterKey);
    if (result.entityType === "landmark") {
      expect(result.description).toBeNull();
    }
  });

  it("decrypts structure-entity variant", () => {
    const result = decryptInnerWorldEntity(makeRaw(makeStructureEntityPayload()), masterKey);
    expect(result.entityType).toBe("structure-entity");
    if (result.entityType === "structure-entity") {
      expect(result.linkedStructureEntityId).toBe("se_xyz");
    }
  });

  it("returns archived variant with archivedAt", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeRaw(makeMemberPayload(), { archived: true, archivedAt });
    const result = decryptInnerWorldEntity(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeRaw(makeMemberPayload(), { archived: true, archivedAt: null });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("throws for unknown entity type", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob(
        { entityType: "unknown", positionX: 0, positionY: 0, visual: VISUAL },
        masterKey,
      ),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/entityType/);
  });

  it("handles null regionId", () => {
    const raw = makeRaw(makeMemberPayload(), { regionId: null });
    const result = decryptInnerWorldEntity(raw, masterKey);
    expect(result.regionId).toBeNull();
  });
});

describe("decryptInnerWorldEntityPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const page = {
      data: [makeRaw(makeMemberPayload()), makeRaw(makeLandmarkPayload())],
      nextCursor: "cursor_abc",
    };
    const result = decryptInnerWorldEntityPage(page, masterKey);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = decryptInnerWorldEntityPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptInnerWorldEntityInput", () => {
  it("round-trips through decrypt", () => {
    const payload = makeMemberPayload();
    const { encryptedData } = encryptInnerWorldEntityInput(payload, masterKey);
    const raw = makeRaw(payload, { encryptedData });
    const result = decryptInnerWorldEntity(raw, masterKey);
    expect(result.entityType).toBe("member");
    expect(result.positionX).toBe(10);
  });
});

describe("encryptInnerWorldEntityUpdate", () => {
  it("includes version", () => {
    const result = encryptInnerWorldEntityUpdate(makeMemberPayload(), 5, masterKey);
    expect(result.version).toBe(5);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("decryptInnerWorldEntity Zod validation", () => {
  it("throws when blob is not an object", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob("string", masterKey),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/object/);
  });

  it("throws when entityType is missing", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob({ positionX: 0 }, masterKey),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/entityType/);
  });

  it("throws when member missing linkedMemberId", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob(
        { entityType: "member", positionX: 0, positionY: 0, visual: VISUAL },
        masterKey,
      ),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/linkedMemberId/);
  });

  it("throws when landmark missing name", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob(
        { entityType: "landmark", positionX: 0, positionY: 0, visual: VISUAL },
        masterKey,
      ),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/"name"/);
  });

  it("throws when structure-entity missing linkedStructureEntityId", () => {
    const raw = makeRaw(makeMemberPayload(), {
      encryptedData: makeBase64Blob(
        { entityType: "structure-entity", positionX: 0, positionY: 0, visual: VISUAL },
        masterKey,
      ),
    });
    expect(() => decryptInnerWorldEntity(raw, masterKey)).toThrow(/linkedStructureEntityId/);
  });
});
