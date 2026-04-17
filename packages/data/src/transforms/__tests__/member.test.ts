import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptMember,
  decryptMemberPage,
  encryptMemberInput,
  encryptMemberUpdate,
} from "../member.js";

import { makeBase64Blob } from "./helpers.js";

import type { MemberEncryptedFields } from "../member.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { HexColor, MemberId, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

/** Minimal encrypted fields fixture for a fully-populated member. */
function makeEncryptedFields(): MemberEncryptedFields {
  return {
    name: "River",
    pronouns: ["they/them", "xe/xem"],
    description: "A calm, creative headmate.",
    avatarSource: null,
    colors: ["#aabbcc" as HexColor],
    saturationLevel: { kind: "known", level: "highly-elaborated" },
    tags: [
      { kind: "known", tag: "host" },
      { kind: "custom", value: "artist" },
    ],
    suppressFriendFrontNotification: false,
    boardMessageNotificationOnFront: true,
  };
}

/** Build a minimal ServerMember wire object from encrypted fields. */
function makeServerMember(
  fields: MemberEncryptedFields = makeEncryptedFields(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: brandId<MemberId>("mem_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 3,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

describe("decryptMember", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerMember();
    const result = decryptMember(raw, masterKey);

    expect(result.id).toBe("mem_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.version).toBe(3);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_001_000_000);
    expect(result.archived).toBe(false);

    expect(result.name).toBe("River");
    expect(result.pronouns).toEqual(["they/them", "xe/xem"]);
    expect(result.description).toBe("A calm, creative headmate.");
    expect(result.avatarSource).toBeNull();
    expect(result.colors).toEqual(["#aabbcc"]);
    expect(result.saturationLevel).toEqual({ kind: "known", level: "highly-elaborated" });
    expect(result.tags).toEqual([
      { kind: "known", tag: "host" },
      { kind: "custom", value: "artist" },
    ]);
    expect(result.suppressFriendFrontNotification).toBe(false);
    expect(result.boardMessageNotificationOnFront).toBe(true);
  });

  it("handles null optional fields correctly", () => {
    const fields: MemberEncryptedFields = {
      name: "Ghost",
      pronouns: [],
      description: null,
      avatarSource: null,
      colors: [],
      saturationLevel: { kind: "custom", value: "nebulous" },
      tags: [],
      suppressFriendFrontNotification: true,
      boardMessageNotificationOnFront: false,
    };
    const raw = makeServerMember(fields);
    const result = decryptMember(raw, masterKey);

    expect(result.name).toBe("Ghost");
    expect(result.pronouns).toEqual([]);
    expect(result.description).toBeNull();
    expect(result.colors).toEqual([]);
    expect(result.saturationLevel).toEqual({ kind: "custom", value: "nebulous" });
    expect(result.tags).toEqual([]);
    expect(result.suppressFriendFrontNotification).toBe(true);
    expect(result.boardMessageNotificationOnFront).toBe(false);
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerMember(), encryptedData: "not-valid-base64!!!" };
    expect(() => decryptMember(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerMember(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptMember(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.name).toBe("River");
  });
});

describe("assertMemberEncryptedFields validation", () => {
  it("throws when description is a number instead of string or null", () => {
    const fields = { ...makeEncryptedFields(), description: 42 };
    const raw = { ...makeServerMember(), encryptedData: encryptAndEncodeT1(fields, masterKey) };
    expect(() => decryptMember(raw, masterKey)).toThrow("description must be string or null");
  });

  it("throws when suppressFriendFrontNotification is missing", () => {
    const {
      name,
      pronouns,
      description,
      avatarSource,
      colors,
      saturationLevel,
      tags,
      boardMessageNotificationOnFront,
    } = makeEncryptedFields();
    const raw = {
      ...makeServerMember(),
      encryptedData: encryptAndEncodeT1(
        {
          name,
          pronouns,
          description,
          avatarSource,
          colors,
          saturationLevel,
          tags,
          boardMessageNotificationOnFront,
        },
        masterKey,
      ),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("suppressFriendFrontNotification");
  });

  it("throws when boardMessageNotificationOnFront is missing", () => {
    const {
      name,
      pronouns,
      description,
      avatarSource,
      colors,
      saturationLevel,
      tags,
      suppressFriendFrontNotification,
    } = makeEncryptedFields();
    const raw = {
      ...makeServerMember(),
      encryptedData: encryptAndEncodeT1(
        {
          name,
          pronouns,
          description,
          avatarSource,
          colors,
          saturationLevel,
          tags,
          suppressFriendFrontNotification,
        },
        masterKey,
      ),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("boardMessageNotificationOnFront");
  });

  it("throws when avatarSource is missing (undefined)", () => {
    const {
      name,
      pronouns,
      description,
      colors,
      saturationLevel,
      tags,
      suppressFriendFrontNotification,
      boardMessageNotificationOnFront,
    } = makeEncryptedFields();
    const raw = {
      ...makeServerMember(),
      encryptedData: encryptAndEncodeT1(
        {
          name,
          pronouns,
          description,
          colors,
          saturationLevel,
          tags,
          suppressFriendFrontNotification,
          boardMessageNotificationOnFront,
        },
        masterKey,
      ),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("avatarSource");
  });

  it("throws when colors is missing (undefined)", () => {
    const {
      name,
      pronouns,
      description,
      avatarSource,
      saturationLevel,
      tags,
      suppressFriendFrontNotification,
      boardMessageNotificationOnFront,
    } = makeEncryptedFields();
    const raw = {
      ...makeServerMember(),
      encryptedData: encryptAndEncodeT1(
        {
          name,
          pronouns,
          description,
          avatarSource,
          saturationLevel,
          tags,
          suppressFriendFrontNotification,
          boardMessageNotificationOnFront,
        },
        masterKey,
      ),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("colors");
  });

  it("throws when saturationLevel is missing (undefined)", () => {
    const {
      name,
      pronouns,
      description,
      avatarSource,
      colors,
      tags,
      suppressFriendFrontNotification,
      boardMessageNotificationOnFront,
    } = makeEncryptedFields();
    const raw = {
      ...makeServerMember(),
      encryptedData: encryptAndEncodeT1(
        {
          name,
          pronouns,
          description,
          avatarSource,
          colors,
          tags,
          suppressFriendFrontNotification,
          boardMessageNotificationOnFront,
        },
        masterKey,
      ),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("saturationLevel");
  });

  it("throws when tags is not an array", () => {
    const fields = { ...makeEncryptedFields(), tags: "not-an-array" };
    const raw = { ...makeServerMember(), encryptedData: encryptAndEncodeT1(fields, masterKey) };
    expect(() => decryptMember(raw, masterKey)).toThrow("tags");
  });
});

describe("decryptMemberPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerMember(), makeServerMember()];
    const page = { data, nextCursor: "cursor-token" };
    const result = decryptMemberPage(page, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.data.forEach((m) => {
      expect(m.name).toBe("River");
    });
  });

  it("handles null cursor", () => {
    const page = { data: [makeServerMember()], nextCursor: null };
    const result = decryptMemberPage(page, masterKey);
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty data array", () => {
    const page = { data: [] as ReturnType<typeof makeServerMember>[], nextCursor: null };
    const result = decryptMemberPage(page, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  // ── Failed-decryption propagation (DATA-TC-L2) ──────────────────────
  //
  // A corrupt member entry in a page must propagate as a thrown error, not
  // be silently dropped from the returned list. Silently skipping corrupt
  // entries would let a single tampered/broken row disappear from the UI
  // without any caller signal — breaking our fail-loud posture for
  // cryptographic errors.

  it("throws when every member in the page has corrupt encryptedData", () => {
    const page = {
      data: [
        { ...makeServerMember(), encryptedData: "not-valid-base64!!!" },
        { ...makeServerMember(), encryptedData: "also-garbage!!!" },
      ],
      nextCursor: null,
    };
    expect(() => decryptMemberPage(page, masterKey)).toThrow();
  });

  it("throws when any member in a mixed page has corrupt encryptedData", () => {
    const page = {
      data: [
        makeServerMember(), // good
        { ...makeServerMember(), encryptedData: "not-valid-base64!!!" }, // corrupt
        makeServerMember(), // good
      ],
      nextCursor: "cursor-x",
    };
    expect(() => decryptMemberPage(page, masterKey)).toThrow();
  });

  it("throws when a member in the page is missing required decrypted fields", () => {
    // Blob decrypts cleanly but fails the field-shape assertion — this too
    // must propagate rather than silently drop the entry.
    const badFields = { name: "River" }; // missing pronouns, etc.
    const page = {
      data: [
        makeServerMember(),
        { ...makeServerMember(), encryptedData: makeBase64Blob(badFields, masterKey) },
      ],
      nextCursor: null,
    };
    expect(() => decryptMemberPage(page, masterKey)).toThrow(
      "missing required array field: pronouns",
    );
  });
});

describe("encryptMemberInput", () => {
  it("encrypts fields to a base64 encryptedData string", () => {
    const fields = makeEncryptedFields();
    const result = encryptMemberInput(fields, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptMemberInput(fields, masterKey);
    const raw = {
      ...makeServerMember(),
      encryptedData,
    };
    const member = decryptMember(raw, masterKey);

    expect(member.name).toBe(fields.name);
    expect(member.pronouns).toEqual(fields.pronouns);
    expect(member.description).toBe(fields.description);
    expect(member.colors).toEqual(fields.colors);
    expect(member.saturationLevel).toEqual(fields.saturationLevel);
    expect(member.tags).toEqual(fields.tags);
    expect(member.suppressFriendFrontNotification).toBe(fields.suppressFriendFrontNotification);
    expect(member.boardMessageNotificationOnFront).toBe(fields.boardMessageNotificationOnFront);
  });
});

describe("encryptMemberUpdate", () => {
  it("includes version in the output", () => {
    const fields = makeEncryptedFields();
    const result = encryptMemberUpdate(fields, 7, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(7);
  });

  it("round-trips through decryptMember", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptMemberUpdate(fields, 2, masterKey);
    const raw = { ...makeServerMember(), encryptedData, version: 2 };
    const member = decryptMember(raw, masterKey);

    expect(member.name).toBe(fields.name);
  });
});

// ── Assertion guard tests ────────────────────────────────────────────

describe("assertMemberEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = {
      ...makeServerMember(),
      encryptedData: makeBase64Blob("not-an-object", masterKey),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing name field", () => {
    const raw = {
      ...makeServerMember(),
      encryptedData: makeBase64Blob({ pronouns: [] }, masterKey),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("missing required string field: name");
  });

  it("throws when blob is missing pronouns array", () => {
    const raw = {
      ...makeServerMember(),
      encryptedData: makeBase64Blob({ name: "Test" }, masterKey),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("missing required array field: pronouns");
  });

  it("throws when pronouns is not an array", () => {
    const raw = {
      ...makeServerMember(),
      encryptedData: makeBase64Blob({ name: "Test", pronouns: "not-array" }, masterKey),
    };
    expect(() => decryptMember(raw, masterKey)).toThrow("missing required array field: pronouns");
  });
});
