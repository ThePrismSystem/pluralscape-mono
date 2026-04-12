import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { frontingCommentPersister } from "../fronting-comment.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    content: "hello",
  },
  frontingSessionId: "fs_1",
  createdAt: 1_700_000_000_000,
  memberId: null,
  customFrontId: null,
  structureEntityId: null,
};

describe("frontingCommentPersister", () => {
  it("create encrypts and calls frontingComment.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.frontingComment.create);
    const result = await frontingCommentPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String), sessionId: "fs_1" }),
    );
    expect(result.pluralscapeEntityId).toBe("fcom_1");
  });

  it("update targets the existing comment ID and passes sessionId", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.frontingComment.update);
    await frontingCommentPersister.update(ctx, VALID_PAYLOAD, "fcom_existing");
    const call = updateFn.mock.calls[0];
    expect(call?.[1]).toBe("fcom_existing");
    expect(call?.[2]).toMatchObject({ sessionId: "fs_1" });
  });

  it("rejects malformed payloads", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      frontingCommentPersister.create(ctx, { encrypted: { content: 42 } }),
    ).rejects.toThrow(/invalid payload for fronting-comment/);
  });
});
