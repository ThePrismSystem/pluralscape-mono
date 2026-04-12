import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { boardMessagePersister } from "../board-message.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    content: "hello everyone",
    senderId: "mem_1",
  },
  sortOrder: 0,
  pinned: false,
  createdAt: 1_700_000_000_000,
};

describe("boardMessagePersister", () => {
  it("create encrypts and calls boardMessage.create with sortOrder", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.boardMessage.create);
    const result = await boardMessagePersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String), sortOrder: 0 }),
    );
    expect(result.pluralscapeEntityId).toBe("bm_1");
  });

  it("update targets the existing board message ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.boardMessage.update);
    await boardMessagePersister.update(ctx, VALID_PAYLOAD, "bm_existing");
    expect(updateFn.mock.calls[0]?.[1]).toBe("bm_existing");
  });

  it("rejects payloads missing content", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      boardMessagePersister.create(ctx, { encrypted: {}, sortOrder: 0, createdAt: 0 }),
    ).rejects.toThrow(/invalid payload for board-message/);
  });
});
