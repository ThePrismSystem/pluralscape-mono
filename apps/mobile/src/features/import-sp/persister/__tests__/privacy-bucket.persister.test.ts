import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { privacyBucketPersister } from "../privacy-bucket.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    name: "Trusted",
    description: "visible to trusted friends",
  },
};

describe("privacyBucketPersister", () => {
  it("create encrypts and issues bucket.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.bucket.create);
    const result = await privacyBucketPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String) }),
    );
    expect(result.pluralscapeEntityId).toBe("bkt_1");
  });

  it("update issues bucket.update with the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.bucket.update);
    const result = await privacyBucketPersister.update(ctx, VALID_PAYLOAD, "bkt_existing");
    expect(updateFn).toHaveBeenCalledTimes(1);
    const call = updateFn.mock.calls[0];
    expect(call?.[0]).toBe(TEST_SYSTEM_ID);
    expect(call?.[1]).toBe("bkt_existing");
    expect(call?.[2]).toEqual({
      encryptedData: expect.any(String),
      version: 1,
    });
    expect(result.pluralscapeEntityId).toBe("bkt_1");
  });

  it("rejects malformed payloads on create", async () => {
    const ctx = makeTestPersisterContext();
    await expect(privacyBucketPersister.create(ctx, { encrypted: { name: 42 } })).rejects.toThrow(
      /invalid payload for privacy-bucket/,
    );
  });
});
