import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { channelPersister } from "../channel.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const CHANNEL_WITH_PARENT = {
  name: "memes",
  description: null,
  type: "channel" as const,
  parentChannelId: "ch_parent",
  order: 1,
};

const ORPHAN_CHANNEL = {
  name: "orphan",
  description: null,
  type: "channel" as const,
  parentChannelId: null,
  order: 0,
};

describe("channelPersister", () => {
  it("delegates to the channels table with type=channel and the resolved parent", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.channel.create);

    await channelPersister.create(ctx, CHANNEL_WITH_PARENT);

    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ type: "channel", parentId: "ch_parent" }),
    );
  });

  it("permits orphan channels with parentId=null", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.channel.create);

    await channelPersister.create(ctx, ORPHAN_CHANNEL);

    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ type: "channel", parentId: null }),
    );
  });

  it("update targets the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.channel.update);
    await channelPersister.update(ctx, CHANNEL_WITH_PARENT, "ch_existing");
    expect(updateFn.mock.calls[0]?.[1]).toBe("ch_existing");
  });
});
