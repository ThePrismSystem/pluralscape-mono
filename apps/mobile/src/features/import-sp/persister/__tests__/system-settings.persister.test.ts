import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { systemSettingsPersister } from "../system-settings.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const TEST_EXISTING_ID = "sset_existing";

describe("systemSettingsPersister", () => {
  it("create throws — row pre-exists", async () => {
    const ctx = makeTestPersisterContext();
    await expect(systemSettingsPersister.create(ctx, {})).rejects.toThrow(
      /does not support create/,
    );
  });

  it("update encrypts the settings payload and issues systemSettings.update", async () => {
    const ctx = makeTestPersisterContext();
    const getVersion = vi.mocked(ctx.api.systemSettings.getCurrentVersion);
    const updateFn = vi.mocked(ctx.api.systemSettings.update);

    const payload = { timezone: "UTC", themePreference: "dark" };
    const result = await systemSettingsPersister.update(ctx, payload, TEST_EXISTING_ID);

    expect(getVersion).toHaveBeenCalledWith(TEST_SYSTEM_ID);
    expect(updateFn).toHaveBeenCalledTimes(1);
    const [calledSystemId, updateInput] = updateFn.mock.calls[0] ?? [];
    expect(calledSystemId).toBe(TEST_SYSTEM_ID);
    expect(updateInput).toEqual({
      encryptedData: expect.any(String),
      version: 1,
    });
    expect(result.pluralscapeEntityId).toBe("sset_1");
  });

  it("update rejects a non-object payload", async () => {
    const ctx = makeTestPersisterContext();
    await expect(systemSettingsPersister.update(ctx, null, TEST_EXISTING_ID)).rejects.toThrow(
      /invalid payload for system-settings/,
    );
  });
});
