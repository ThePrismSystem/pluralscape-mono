import { configureSodium, generateBucketKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT2 } from "../decode-blob.js";
import {
  decryptDashboardCustomFront,
  decryptDashboardFrontingSession,
  decryptDashboardMember,
  decryptDashboardStructureEntity,
  decryptFriendDashboard,
} from "../friend-dashboard.js";

import type { AeadKey } from "@pluralscape/crypto";
import type {
  BucketId,
  CustomFrontId,
  FriendDashboardResponse,
  FrontingSessionId,
  HexColor,
  KeyGrantId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

let bucketKey: AeadKey;
const BUCKET_ID = "bkt_test1" as BucketId;
const SYSTEM_ID = "sys_abc" as SystemId;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  bucketKey = generateBucketKey();
});

// ── Fixtures ─────────────────────────────────────────────────────

function makeMemberBlob() {
  return {
    name: "River",
    pronouns: ["they/them"],
    description: "A calm headmate.",
    colors: ["#aabbcc" as HexColor],
  };
}

function makeFrontingSessionBlob() {
  return {
    comment: "Feeling grounded",
    positionality: "front",
    outtrigger: null,
    outtriggerSentiment: null,
  };
}

function makeCustomFrontBlob() {
  return {
    name: "Dissociated",
    description: "Foggy cognitive state",
    color: "#ff0000" as HexColor,
    emoji: "🌫️",
  };
}

function makeStructureEntityBlob() {
  return {
    name: "Protector",
    description: "Shields the system",
    emoji: "🛡️",
    color: "#00ff00" as HexColor,
    imageSource: null,
  };
}

function makeRawResponse(key: AeadKey, bucketId: BucketId): FriendDashboardResponse {
  return {
    systemId: SYSTEM_ID,
    memberCount: 3,
    activeFronting: {
      sessions: [
        {
          id: "fs_s1" as FrontingSessionId,
          memberId: "mem_m1" as MemberId,
          customFrontId: null,
          structureEntityId: null,
          startTime: toUnixMillis(1_700_000_000_000),
          encryptedData: encryptAndEncodeT2(makeFrontingSessionBlob(), key, bucketId),
        },
      ],
      isCofronting: false,
    },
    visibleMembers: [
      {
        id: "mem_m1" as MemberId,
        encryptedData: encryptAndEncodeT2(makeMemberBlob(), key, bucketId),
      },
    ],
    visibleCustomFronts: [
      {
        id: "cf_c1" as CustomFrontId,
        encryptedData: encryptAndEncodeT2(makeCustomFrontBlob(), key, bucketId),
      },
    ],
    visibleStructureEntities: [
      {
        id: "ste_s1" as SystemStructureEntityId,
        encryptedData: encryptAndEncodeT2(makeStructureEntityBlob(), key, bucketId),
      },
    ],
    keyGrants: [
      {
        id: "kg_1" as KeyGrantId,
        bucketId,
        encryptedKey: "unused-in-transform",
        keyVersion: 1,
      },
    ],
  };
}

// ── Individual decrypt tests ─────────────────────────────────────

describe("decryptDashboardMember", () => {
  it("decrypts T2 member blob and returns expected fields", () => {
    const raw = {
      id: "mem_m1" as MemberId,
      encryptedData: encryptAndEncodeT2(makeMemberBlob(), bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardMember(raw, bucketKey);

    expect(result.id).toBe("mem_m1");
    expect(result.name).toBe("River");
    expect(result.pronouns).toEqual(["they/them"]);
    expect(result.description).toBe("A calm headmate.");
    expect(result.colors).toEqual(["#aabbcc"]);
  });

  it("defaults missing optional fields", () => {
    const raw = {
      id: "mem_m2" as MemberId,
      encryptedData: encryptAndEncodeT2({ name: "Kai" }, bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardMember(raw, bucketKey);

    expect(result.pronouns).toEqual([]);
    expect(result.description).toBeNull();
    expect(result.colors).toEqual([]);
  });

  it("throws on non-object blob", () => {
    const raw = {
      id: "mem_bad" as MemberId,
      encryptedData: encryptAndEncodeT2("not-an-object", bucketKey, BUCKET_ID),
    };
    expect(() => decryptDashboardMember(raw, bucketKey)).toThrow("not an object");
  });

  it("throws on missing name field", () => {
    const raw = {
      id: "mem_bad" as MemberId,
      encryptedData: encryptAndEncodeT2({ pronouns: [] }, bucketKey, BUCKET_ID),
    };
    expect(() => decryptDashboardMember(raw, bucketKey)).toThrow("missing required string field");
  });
});

describe("decryptDashboardFrontingSession", () => {
  it("decrypts T2 fronting session blob", () => {
    const raw = {
      id: "fs_s1" as FrontingSessionId,
      memberId: "mem_m1" as MemberId,
      customFrontId: null,
      structureEntityId: null,
      startTime: toUnixMillis(1_700_000_000_000),
      encryptedData: encryptAndEncodeT2(makeFrontingSessionBlob(), bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardFrontingSession(raw, bucketKey);

    expect(result.id).toBe("fs_s1");
    expect(result.memberId).toBe("mem_m1");
    expect(result.comment).toBe("Feeling grounded");
    expect(result.positionality).toBe("front");
    expect(result.outtrigger).toBeNull();
    expect(result.outtriggerSentiment).toBeNull();
  });

  it("defaults all nullable fields when blob is empty object", () => {
    const raw = {
      id: "fs_s2" as FrontingSessionId,
      memberId: null,
      customFrontId: "cf_c1" as CustomFrontId,
      structureEntityId: null,
      startTime: toUnixMillis(1_700_000_000_000),
      encryptedData: encryptAndEncodeT2({}, bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardFrontingSession(raw, bucketKey);

    expect(result.comment).toBeNull();
    expect(result.positionality).toBeNull();
    expect(result.outtrigger).toBeNull();
    expect(result.outtriggerSentiment).toBeNull();
  });
});

describe("decryptDashboardCustomFront", () => {
  it("decrypts T2 custom front blob", () => {
    const raw = {
      id: "cf_c1" as CustomFrontId,
      encryptedData: encryptAndEncodeT2(makeCustomFrontBlob(), bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardCustomFront(raw, bucketKey);

    expect(result.id).toBe("cf_c1");
    expect(result.name).toBe("Dissociated");
    expect(result.description).toBe("Foggy cognitive state");
    expect(result.color).toBe("#ff0000");
    expect(result.emoji).toBe("🌫️");
  });
});

describe("decryptDashboardStructureEntity", () => {
  it("decrypts T2 structure entity blob", () => {
    const raw = {
      id: "ste_s1" as SystemStructureEntityId,
      encryptedData: encryptAndEncodeT2(makeStructureEntityBlob(), bucketKey, BUCKET_ID),
    };
    const result = decryptDashboardStructureEntity(raw, bucketKey);

    expect(result.id).toBe("ste_s1");
    expect(result.name).toBe("Protector");
    expect(result.description).toBe("Shields the system");
    expect(result.emoji).toBe("🛡️");
    expect(result.color).toBe("#00ff00");
    expect(result.imageSource).toBeNull();
  });
});

// ── Composite decrypt tests ──────────────────────────────────────

describe("decryptFriendDashboard", () => {
  it("decrypts all entity types in a full dashboard response", () => {
    const raw = makeRawResponse(bucketKey, BUCKET_ID);
    const resolver = (id: BucketId) => (id === BUCKET_ID ? bucketKey : undefined);
    const result = decryptFriendDashboard(raw, resolver);

    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.memberCount).toBe(3);
    expect(result.activeFronting.isCofronting).toBe(false);
    expect(result.activeFronting.sessions).toHaveLength(1);
    expect(result.activeFronting.sessions[0]?.comment).toBe("Feeling grounded");
    expect(result.visibleMembers).toHaveLength(1);
    expect(result.visibleMembers[0]?.name).toBe("River");
    expect(result.visibleCustomFronts).toHaveLength(1);
    expect(result.visibleCustomFronts[0]?.name).toBe("Dissociated");
    expect(result.visibleStructureEntities).toHaveLength(1);
    expect(result.visibleStructureEntities[0]?.name).toBe("Protector");
  });

  it("returns empty arrays when no bucket keys are available", () => {
    const raw = makeRawResponse(bucketKey, BUCKET_ID);
    const resolver = () => undefined;
    const result = decryptFriendDashboard(raw, resolver);

    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.memberCount).toBe(3);
    expect(result.activeFronting.sessions).toHaveLength(0);
    expect(result.visibleMembers).toHaveLength(0);
    expect(result.visibleCustomFronts).toHaveLength(0);
    expect(result.visibleStructureEntities).toHaveLength(0);
  });

  it("skips entities that fail decryption with available keys", () => {
    const otherKey = generateBucketKey();
    const otherBucketId = "bkt_other" as BucketId;

    // Build response where entities are encrypted with bucketKey
    // but resolver only has otherKey
    const raw = makeRawResponse(bucketKey, BUCKET_ID);
    // Override keyGrants to only reference the other bucket
    const modified: FriendDashboardResponse = {
      ...raw,
      keyGrants: [
        {
          id: "kg_2" as KeyGrantId,
          bucketId: otherBucketId,
          encryptedKey: "unused",
          keyVersion: 1,
        },
      ],
    };
    const resolver = (id: BucketId) => (id === otherBucketId ? otherKey : undefined);
    const result = decryptFriendDashboard(modified, resolver);

    // All entities should be skipped because otherKey can't decrypt bucketKey's blobs
    expect(result.visibleMembers).toHaveLength(0);
    expect(result.visibleCustomFronts).toHaveLength(0);
    expect(result.visibleStructureEntities).toHaveLength(0);
    expect(result.activeFronting.sessions).toHaveLength(0);
  });

  it("handles response with no keyGrants", () => {
    const raw: FriendDashboardResponse = {
      ...makeRawResponse(bucketKey, BUCKET_ID),
      keyGrants: [],
    };
    const resolver = (id: BucketId) => (id === BUCKET_ID ? bucketKey : undefined);
    const result = decryptFriendDashboard(raw, resolver);

    expect(result.visibleMembers).toHaveLength(0);
    expect(result.visibleCustomFronts).toHaveLength(0);
  });

  it("handles empty dashboard response", () => {
    const raw: FriendDashboardResponse = {
      systemId: SYSTEM_ID,
      memberCount: 0,
      activeFronting: { sessions: [], isCofronting: false },
      visibleMembers: [],
      visibleCustomFronts: [],
      visibleStructureEntities: [],
      keyGrants: [
        {
          id: "kg_1" as KeyGrantId,
          bucketId: BUCKET_ID,
          encryptedKey: "unused",
          keyVersion: 1,
        },
      ],
    };
    const resolver = (id: BucketId) => (id === BUCKET_ID ? bucketKey : undefined);
    const result = decryptFriendDashboard(raw, resolver);

    expect(result.memberCount).toBe(0);
    expect(result.visibleMembers).toHaveLength(0);
    expect(result.activeFronting.sessions).toHaveLength(0);
  });
});
