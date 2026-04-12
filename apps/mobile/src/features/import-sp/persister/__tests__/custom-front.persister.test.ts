import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { customFrontPersister } from "../custom-front.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    name: "Dissociated",
    description: "blurry",
    color: "#ff00ff",
    emoji: null,
  },
};

describe("customFrontPersister", () => {
  it("create encrypts and issues customFront.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.customFront.create);
    const result = await customFrontPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String) }),
    );
    expect(result.pluralscapeEntityId).toBe("cf_1");
  });

  it("update issues customFront.update with the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.customFront.update);
    const result = await customFrontPersister.update(ctx, VALID_PAYLOAD, "cf_existing");
    const call = updateFn.mock.calls[0];
    expect(call?.[0]).toBe(TEST_SYSTEM_ID);
    expect(call?.[1]).toBe("cf_existing");
    expect(result.pluralscapeEntityId).toBe("cf_1");
  });

  it("rejects payloads without a name", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      customFrontPersister.create(ctx, { encrypted: { color: "#000" } }),
    ).rejects.toThrow(/invalid payload for custom-front/);
  });
});
