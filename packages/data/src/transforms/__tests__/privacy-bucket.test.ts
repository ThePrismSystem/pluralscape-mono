import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptPrivacyBucket,
  decryptPrivacyBucketPage,
  encryptBucketInput,
  encryptBucketUpdate,
} from "../privacy-bucket.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  BucketId,
  PrivacyBucketEncryptedInput,
  PrivacyBucketWire,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): PrivacyBucketEncryptedInput {
  return {
    name: "Friends",
    description: "Visible to close friends",
  };
}

function makeServerBucket(
  fields: PrivacyBucketEncryptedInput = makeEncryptedFields(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
): PrivacyBucketWire {
  return {
    id: brandId<BucketId>("bkt_test0001"),
    systemId: brandId<SystemId>("sys_test001"),
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("decryptPrivacyBucket", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerBucket();
    const result = decryptPrivacyBucket(raw, masterKey);

    expect(result.id).toBe("bkt_test0001");
    expect(result.systemId).toBe("sys_test001");
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_001_000_000);
    expect(result.archived).toBe(false);

    expect(result.name).toBe("Friends");
    expect(result.description).toBe("Visible to close friends");
  });

  it("handles null description", () => {
    const fields: PrivacyBucketEncryptedInput = { name: "Private", description: null };
    const raw = makeServerBucket(fields);
    const result = decryptPrivacyBucket(raw, masterKey);
    expect(result.description).toBeNull();
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerBucket(), encryptedData: "not-valid-base64!!!" };
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerBucket(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptPrivacyBucket(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.name).toBe("Friends");
  });

  it("throws when archived=true but archivedAt is null", () => {
    const raw = makeServerBucket(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow("missing archivedAt");
  });
});

describe("decryptPrivacyBucketPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerBucket(), makeServerBucket()];
    const page = { data, nextCursor: "cursor_abc" };
    const result = decryptPrivacyBucketPage(page, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
    result.data.forEach((b) => {
      expect(b.name).toBe("Friends");
    });
  });

  it("handles null cursor", () => {
    const page = { data: [makeServerBucket()], nextCursor: null };
    const result = decryptPrivacyBucketPage(page, masterKey);
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty data array", () => {
    const page = { data: [] as PrivacyBucketWire[], nextCursor: null };
    const result = decryptPrivacyBucketPage(page, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptBucketInput", () => {
  it("encrypts fields to a base64 encryptedData string", () => {
    const fields = makeEncryptedFields();
    const result = encryptBucketInput(fields, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptBucketInput(fields, masterKey);
    const raw = { ...makeServerBucket(), encryptedData };
    const bucket = decryptPrivacyBucket(raw, masterKey);

    expect(bucket.name).toBe(fields.name);
    expect(bucket.description).toBe(fields.description);
  });

  it("round-trips null description", () => {
    const fields: PrivacyBucketEncryptedInput = { name: "Secret", description: null };
    const { encryptedData } = encryptBucketInput(fields, masterKey);
    const raw = { ...makeServerBucket(), encryptedData };
    const bucket = decryptPrivacyBucket(raw, masterKey);

    expect(bucket.name).toBe("Secret");
    expect(bucket.description).toBeNull();
  });
});

describe("encryptBucketUpdate", () => {
  it("includes version in the output", () => {
    const fields = makeEncryptedFields();
    const result = encryptBucketUpdate(fields, 7, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(7);
  });

  it("round-trips through decryptPrivacyBucket", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptBucketUpdate(fields, 2, masterKey);
    const raw = { ...makeServerBucket(), encryptedData, version: 2 };
    const bucket = decryptPrivacyBucket(raw, masterKey);

    expect(bucket.name).toBe(fields.name);
    expect(bucket.description).toBe(fields.description);
  });

  it("round-trips null description", () => {
    const fields: PrivacyBucketEncryptedInput = { name: "Hidden", description: null };
    const { encryptedData } = encryptBucketUpdate(fields, 3, masterKey);
    const raw = { ...makeServerBucket(), encryptedData, version: 3 };
    const bucket = decryptPrivacyBucket(raw, masterKey);

    expect(bucket.name).toBe("Hidden");
    expect(bucket.description).toBeNull();
  });
});

describe("decryptPrivacyBucket Zod validation", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = {
      ...makeServerBucket(),
      encryptedData: makeBase64Blob("not-an-object", masterKey),
    };
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow(/object/);
  });

  it("throws when blob is missing name field", () => {
    const raw = {
      ...makeServerBucket(),
      encryptedData: makeBase64Blob({ description: null }, masterKey),
    };
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow(/"name"/);
  });

  it("throws when description key is missing", () => {
    const raw = {
      ...makeServerBucket(),
      encryptedData: makeBase64Blob({ name: "Test" }, masterKey),
    };
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow(/"description"/);
  });

  it("throws when description is invalid type", () => {
    const raw = {
      ...makeServerBucket(),
      encryptedData: makeBase64Blob({ name: "Test", description: 42 }, masterKey),
    };
    expect(() => decryptPrivacyBucket(raw, masterKey)).toThrow(/"description"/);
  });
});
