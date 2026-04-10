import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { systemProfilePersister } from "../system-profile.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const TEST_EXISTING_ID = "sys_existing";

describe("systemProfilePersister", () => {
  it("create throws — system row pre-exists so update is the only legal path", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      systemProfilePersister.create(ctx, {
        name: "Aurora",
        description: null,
        pronouns: null,
        avatarUrl: null,
      }),
    ).rejects.toThrow(/does not support create/);
  });

  it("update reads version, encrypts, and issues system.update", async () => {
    const ctx = makeTestPersisterContext();
    const getVersion = vi.mocked(ctx.api.system.getCurrentVersion);
    const updateFn = vi.mocked(ctx.api.system.update);

    const payload = {
      name: "Aurora",
      description: "the collective",
      pronouns: "they/them",
      avatarUrl: null,
    };

    const result = await systemProfilePersister.update(ctx, payload, TEST_EXISTING_ID);

    expect(getVersion).toHaveBeenCalledWith(TEST_SYSTEM_ID);
    expect(updateFn).toHaveBeenCalledTimes(1);
    const [calledSystemId, updateInput] = updateFn.mock.calls[0] ?? [];
    expect(calledSystemId).toBe(TEST_SYSTEM_ID);
    expect(updateInput).toEqual({
      encryptedData: expect.any(String),
      version: 1,
    });
    expect(result.pluralscapeEntityId).toBe("sys_1");
  });

  it("update rejects malformed payloads", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      systemProfilePersister.update(ctx, { name: 42 }, TEST_EXISTING_ID),
    ).rejects.toThrow(/invalid payload for system-profile/);
  });
});
