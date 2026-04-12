import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { fieldDefinitionPersister } from "../field-definition.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    name: "Age",
    description: null,
    options: null,
  },
  fieldType: "number",
  required: false,
  sortOrder: 3,
};

describe("fieldDefinitionPersister", () => {
  it("create encrypts and issues field.create with fieldType", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.field.create);
    const result = await fieldDefinitionPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({
        encryptedData: expect.any(String),
        fieldType: "number",
        required: false,
        sortOrder: 3,
      }),
    );
    expect(result.pluralscapeEntityId).toBe("fld_1");
  });

  it("update issues field.update with the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.field.update);
    const result = await fieldDefinitionPersister.update(ctx, VALID_PAYLOAD, "fld_existing");
    expect(updateFn).toHaveBeenCalledTimes(1);
    const call = updateFn.mock.calls[0];
    expect(call?.[0]).toBe(TEST_SYSTEM_ID);
    expect(call?.[1]).toBe("fld_existing");
    expect(call?.[2]).toEqual({
      encryptedData: expect.any(String),
      version: 1,
    });
    expect(result.pluralscapeEntityId).toBe("fld_1");
  });

  it("rejects payloads missing the type field", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      fieldDefinitionPersister.create(ctx, {
        encrypted: { name: "X", description: null, options: null },
        required: false,
        sortOrder: 0,
      }),
    ).rejects.toThrow(/invalid payload for field-definition/);
  });
});
