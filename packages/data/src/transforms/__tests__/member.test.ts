import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
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
import type { HexColor, MemberId, SystemId } from "@pluralscape/types";

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
function makeServerMember(fields: MemberEncryptedFields = makeEncryptedFields()) {
  return {
    id: "mem_abc123" as MemberId,
    systemId: "sys_xyz789" as SystemId,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 3,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as const,
    archivedAt: null,
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
});

describe("decryptMemberPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const items = [makeServerMember(), makeServerMember()];
    const page = { items, nextCursor: "cursor-token" };
    const result = decryptMemberPage(page, masterKey);

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.items.forEach((m) => {
      expect(m.name).toBe("River");
    });
  });

  it("handles null cursor", () => {
    const page = { items: [makeServerMember()], nextCursor: null };
    const result = decryptMemberPage(page, masterKey);
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty items array", () => {
    const page = { items: [], nextCursor: null };
    const result = decryptMemberPage(page, masterKey);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
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
