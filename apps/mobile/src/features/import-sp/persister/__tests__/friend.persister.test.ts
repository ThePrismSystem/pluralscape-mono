import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { friendPersister } from "../friend.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  externalUserId: "sp_friend_abc",
  status: "accepted" as const,
  seeMembers: true,
  seeFront: true,
  trusted: false,
  getFrontNotif: false,
  createdAt: null,
};

describe("friendPersister", () => {
  it("records the external reference and returns the placeholder ID", async () => {
    const ctx = makeTestPersisterContext();
    const record = vi.mocked(ctx.api.friend.recordExternalReference);
    const result = await friendPersister.create(ctx, VALID_PAYLOAD);
    expect(record).toHaveBeenCalledWith(TEST_SYSTEM_ID, "sp_friend_abc", "accepted");
    expect(result.pluralscapeEntityId).toBe("fc_placeholder");
  });

  it("update returns the existing ID unchanged after re-recording", async () => {
    const ctx = makeTestPersisterContext();
    const record = vi.mocked(ctx.api.friend.recordExternalReference);
    const result = await friendPersister.update(ctx, VALID_PAYLOAD, "fc_existing");
    expect(record).toHaveBeenCalled();
    expect(result.pluralscapeEntityId).toBe("fc_existing");
  });

  it("rejects payloads with a bad status enum", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      friendPersister.create(ctx, { externalUserId: "sp_x", status: "weird" }),
    ).rejects.toThrow(/invalid payload for friend/);
  });
});
