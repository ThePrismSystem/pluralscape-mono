import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestIdTranslation,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { fieldValuePersister } from "../field-value.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  memberSourceId: "sp_member_1",
  fieldSourceId: "sp_field_1",
  value: "hello world",
  memberPluralscapeId: "mem_1",
};

describe("fieldValuePersister", () => {
  it("resolves the field definition via IdTranslationTable and calls field.setValue", async () => {
    const idTable = makeTestIdTranslation();
    idTable.set("field-definition", "sp_field_1", "fld_resolved");
    const ctx = makeTestPersisterContext({ idTranslation: idTable });
    const setValue = vi.mocked(ctx.api.field.setValue);

    const result = await fieldValuePersister.create(ctx, VALID_PAYLOAD);

    expect(setValue).toHaveBeenCalledWith(TEST_SYSTEM_ID, {
      memberId: "mem_1",
      fieldDefinitionId: "fld_resolved",
      encryptedData: expect.any(String),
    });
    expect(result.pluralscapeEntityId).toBe("fv_1");
  });

  it("throws when the field definition is not in the translation table", async () => {
    const ctx = makeTestPersisterContext();
    await expect(fieldValuePersister.create(ctx, VALID_PAYLOAD)).rejects.toThrow(
      /unresolved field-definition/,
    );
  });

  it("rejects malformed payloads", async () => {
    const ctx = makeTestPersisterContext();
    await expect(fieldValuePersister.create(ctx, { fieldSourceId: "sp_field_1" })).rejects.toThrow(
      /invalid payload for field-value/,
    );
  });
});
