import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { channelCategoryPersister } from "../channel-category.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  name: "General",
  description: null,
  type: "category" as const,
  parentChannelId: null,
  order: 0,
};

describe("channelCategoryPersister", () => {
  it("delegates to the channels table with type=category", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.channel.create);

    await channelCategoryPersister.create(ctx, VALID_PAYLOAD);

    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ type: "category", parentId: null }),
    );
  });

  it("rejects a payload with a non-null parentChannelId", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      channelCategoryPersister.create(ctx, { ...VALID_PAYLOAD, parentChannelId: "ch_other" }),
    ).rejects.toThrow(/non-null parentChannelId/);
  });

  it("update calls channel.update with the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.channel.update);
    await channelCategoryPersister.update(ctx, VALID_PAYLOAD, "ch_existing");
    expect(updateFn.mock.calls[0]?.[1]).toBe("ch_existing");
  });
});
