import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { groupPersister } from "../group.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    name: "Alpha",
    description: "first group",
    imageSource: null,
    color: "#ff00ff",
    emoji: null,
  },
  parentGroupId: null,
  sortOrder: 0,
  memberIds: ["mem_1", "mem_2", "mem_3"],
};

describe("groupPersister", () => {
  it("create passes memberIds, parentGroupId, and sortOrder with encryptedData", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.group.create);
    const result = await groupPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({
        encryptedData: expect.any(String),
        memberIds: ["mem_1", "mem_2", "mem_3"],
        parentGroupId: null,
        sortOrder: 0,
      }),
    );
    expect(result.pluralscapeEntityId).toBe("grp_1");
  });

  it("update targets the existing group ID and includes memberIds", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.group.update);
    await groupPersister.update(ctx, VALID_PAYLOAD, "grp_existing");
    const call = updateFn.mock.calls[0];
    expect(call?.[1]).toBe("grp_existing");
    expect(call?.[2]).toEqual(expect.objectContaining({ memberIds: ["mem_1", "mem_2", "mem_3"] }));
  });

  it("rejects payloads without memberIds", async () => {
    const ctx = makeTestPersisterContext();
    await expect(groupPersister.create(ctx, { encrypted: { name: "no members" } })).rejects.toThrow(
      /invalid payload for group/,
    );
  });
});
