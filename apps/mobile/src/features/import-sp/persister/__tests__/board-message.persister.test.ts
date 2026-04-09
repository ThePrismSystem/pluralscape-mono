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
  title: "First post",
  body: "hello everyone",
  authorMemberId: "mem_1",
  createdAt: 1_700_000_000_000,
};

describe("boardMessagePersister", () => {
  it("create encrypts and calls boardMessage.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.boardMessage.create);
    const result = await boardMessagePersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String) }),
    );
    expect(result.pluralscapeEntityId).toBe("bm_1");
  });

  it("update targets the existing board message ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.boardMessage.update);
    await boardMessagePersister.update(ctx, VALID_PAYLOAD, "bm_existing");
    expect(updateFn.mock.calls[0]?.[1]).toBe("bm_existing");
  });

  it("rejects payloads missing a title", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      boardMessagePersister.create(ctx, { body: "x", authorMemberId: "mem_1" }),
    ).rejects.toThrow(/invalid payload for board-message/);
  });
});
