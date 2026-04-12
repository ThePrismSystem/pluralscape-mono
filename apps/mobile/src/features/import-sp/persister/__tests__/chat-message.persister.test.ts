import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { chatMessagePersister } from "../chat-message.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  channelId: "ch_1",
  writerMemberId: "mem_1",
  body: "hello world",
  createdAt: 1_700_000_000_000,
  replyToChatMessageId: null,
};

describe("chatMessagePersister", () => {
  it("create encrypts and passes channelId and timestamp alongside encryptedData", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.message.create);
    const result = await chatMessagePersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({
        channelId: "ch_1",
        timestamp: 1_700_000_000_000,
        encryptedData: expect.any(String),
      }),
    );
    expect(result.pluralscapeEntityId).toBe("msg_1");
  });

  it("update targets the existing message ID and passes channelId", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.message.update);
    await chatMessagePersister.update(ctx, VALID_PAYLOAD, "msg_existing");
    expect(updateFn.mock.calls[0]?.[1]).toBe("msg_existing");
    expect(updateFn.mock.calls[0]?.[2]).toMatchObject({ channelId: "ch_1" });
  });

  it("rejects payloads without a body", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      chatMessagePersister.create(ctx, {
        channelId: "ch_1",
        writerMemberId: "mem_1",
        createdAt: 0,
        replyToChatMessageId: null,
      }),
    ).rejects.toThrow(/invalid payload for chat-message/);
  });
});
