import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptCustomFront,
  decryptCustomFrontPage,
  encryptCustomFrontInput,
  encryptCustomFrontUpdate,
} from "../custom-front.js";

import { makeBase64Blob } from "./helpers.js";

import type { CustomFrontEncryptedFields } from "../custom-front.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { CustomFrontId, HexColor, SystemId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

// ── Server shape helpers ─────────────────────────────────────────────

function makeRawCustomFront(
  fields: CustomFrontEncryptedFields,
  key: KdfMasterKey,
  overrides?: Partial<{
    id: CustomFrontId;
    systemId: SystemId;
    version: number;
    archived: boolean;
    archivedAt: UnixMillis | null;
    createdAt: UnixMillis;
    updatedAt: UnixMillis;
  }>,
) {
  return {
    id: "cf_abc123" as CustomFrontId,
    systemId: "sys_xyz" as SystemId,
    encryptedData: makeBase64Blob(fields, key),
    version: 1,
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    createdAt: 1_700_000_000_000 as UnixMillis,
    updatedAt: 1_700_000_000_000 as UnixMillis,
    ...overrides,
  };
}

// ── decryptCustomFront ───────────────────────────────────────────────

describe("decryptCustomFront", () => {
  it("decrypts all encrypted fields and passes through transparent fields", () => {
    const fields: CustomFrontEncryptedFields = {
      name: "Dissociated",
      description: "A foggy state",
      color: "#aabbcc" as HexColor,
      emoji: "🌫️",
    };
    const raw = makeRawCustomFront(fields, masterKey);
    const result = decryptCustomFront(raw, masterKey);

    expect(result.id).toBe("cf_abc123");
    expect(result.systemId).toBe("sys_xyz");
    expect(result.name).toBe("Dissociated");
    expect(result.description).toBe("A foggy state");
    expect(result.color).toBe("#aabbcc");
    expect(result.emoji).toBe("🌫️");
    expect(result.archived).toBe(false);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_000_000);
  });

  it("handles null optional fields", () => {
    const fields: CustomFrontEncryptedFields = {
      name: "Blurry",
      description: null,
      color: null,
      emoji: null,
    };
    const raw = makeRawCustomFront(fields, masterKey);
    const result = decryptCustomFront(raw, masterKey);

    expect(result.name).toBe("Blurry");
    expect(result.description).toBeNull();
    expect(result.color).toBeNull();
    expect(result.emoji).toBeNull();
  });

  it("throws when encryptedData is not a valid base64 blob", () => {
    const raw = makeRawCustomFront(
      { name: "X", description: null, color: null, emoji: null },
      masterKey,
    );
    const invalid = { ...raw, encryptedData: "not-valid-base64!!!" };
    expect(() => decryptCustomFront(invalid, masterKey)).toThrow();
  });

  it("throws when blob was encrypted with a different key", () => {
    const otherKey = generateMasterKey();
    const fields: CustomFrontEncryptedFields = {
      name: "Ghost",
      description: null,
      color: null,
      emoji: null,
    };
    const raw = makeRawCustomFront(fields, otherKey);
    expect(() => decryptCustomFront(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const fields: CustomFrontEncryptedFields = {
      name: "Archived Front",
      description: null,
      color: null,
      emoji: null,
    };
    const archivedAt = 1_700_002_000_000 as UnixMillis;
    const raw = makeRawCustomFront(fields, masterKey, { archived: true, archivedAt });
    const result = decryptCustomFront(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.name).toBe("Archived Front");
  });
});

// ── decryptCustomFrontPage ───────────────────────────────────────────

describe("decryptCustomFrontPage", () => {
  it("decrypts each item and preserves nextCursor", () => {
    const fields1: CustomFrontEncryptedFields = {
      name: "Alpha",
      description: null,
      color: null,
      emoji: null,
    };
    const fields2: CustomFrontEncryptedFields = {
      name: "Beta",
      description: "desc",
      color: null,
      emoji: "✨",
    };
    const raw1 = makeRawCustomFront(fields1, masterKey, { id: "cf_001" as CustomFrontId });
    const raw2 = makeRawCustomFront(fields2, masterKey, { id: "cf_002" as CustomFrontId });

    const page = {
      data: [raw1, raw2] as const,
      nextCursor: "cf_002" as string | null,
      hasMore: true,
      totalCount: null as number | null,
    };

    const result = decryptCustomFrontPage(page, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.name).toBe("Alpha");
    expect(result.data[1]?.name).toBe("Beta");
    expect(result.data[1]?.emoji).toBe("✨");
    expect(result.nextCursor).toBe("cf_002");
  });

  it("returns null nextCursor when page has no more items", () => {
    const fields: CustomFrontEncryptedFields = {
      name: "Solo",
      description: null,
      color: null,
      emoji: null,
    };
    const raw = makeRawCustomFront(fields, masterKey);
    const page = {
      data: [raw] as const,
      nextCursor: null as string | null,
      hasMore: false,
      totalCount: null as number | null,
    };

    const result = decryptCustomFrontPage(page, masterKey);
    expect(result.nextCursor).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it("returns empty data array for empty page", () => {
    const page = {
      data: [] as ReturnType<typeof makeRawCustomFront>[],
      nextCursor: null as string | null,
      hasMore: false,
      totalCount: null as number | null,
    };
    const result = decryptCustomFrontPage(page, masterKey);
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptCustomFrontInput ──────────────────────────────────────────

describe("encryptCustomFrontInput", () => {
  it("returns encryptedData that decrypts back to the original fields", () => {
    const input: CustomFrontEncryptedFields = {
      name: "Overwhelmed",
      description: "Too much sensory input",
      color: "#ff0000" as HexColor,
      emoji: "😵",
    };

    const { encryptedData } = encryptCustomFrontInput(input, masterKey);

    expect(typeof encryptedData).toBe("string");

    // Round-trip: wrap in server shape and decrypt
    const raw = { ...makeRawCustomFront(input, masterKey), encryptedData };
    const result = decryptCustomFront(raw, masterKey);
    expect(result.name).toBe("Overwhelmed");
    expect(result.description).toBe("Too much sensory input");
    expect(result.color).toBe("#ff0000");
    expect(result.emoji).toBe("😵");
  });

  it("produces a different ciphertext on each call (nonce randomness)", () => {
    const input: CustomFrontEncryptedFields = {
      name: "Test",
      description: null,
      color: null,
      emoji: null,
    };
    const { encryptedData: a } = encryptCustomFrontInput(input, masterKey);
    const { encryptedData: b } = encryptCustomFrontInput(input, masterKey);
    expect(a).not.toBe(b);
  });
});

// ── encryptCustomFrontUpdate ─────────────────────────────────────────

describe("encryptCustomFrontUpdate", () => {
  it("returns encryptedData and version", () => {
    const data: CustomFrontEncryptedFields = {
      name: "Updated Name",
      description: null,
      color: null,
      emoji: null,
    };
    const { encryptedData, version } = encryptCustomFrontUpdate(data, 3, masterKey);

    expect(typeof encryptedData).toBe("string");
    expect(version).toBe(3);
  });

  it("round-trips through decryptCustomFront", () => {
    const data: CustomFrontEncryptedFields = {
      name: "Round-trip",
      description: "desc",
      color: "#123456" as HexColor,
      emoji: "🔄",
    };
    const { encryptedData, version } = encryptCustomFrontUpdate(data, 7, masterKey);
    const raw = { ...makeRawCustomFront(data, masterKey), encryptedData, version };
    const result = decryptCustomFront(raw, masterKey);

    expect(result.name).toBe("Round-trip");
    expect(result.description).toBe("desc");
    expect(result.color).toBe("#123456");
    expect(result.emoji).toBe("🔄");
    expect(result.version).toBe(7);
  });
});
