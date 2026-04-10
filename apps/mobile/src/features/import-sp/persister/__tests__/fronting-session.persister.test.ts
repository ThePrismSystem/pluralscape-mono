import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { frontingSessionPersister } from "../fronting-session.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  memberId: "mem_1",
  customFrontId: null,
  startTime: 1_700_000_000_000,
  endTime: null,
  comment: null,
};

describe("frontingSessionPersister", () => {
  it("create encrypts and calls frontingSession.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.frontingSession.create);
    const result = await frontingSessionPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String) }),
    );
    expect(result.pluralscapeEntityId).toBe("fs_1");
  });

  it("update targets the existing ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.frontingSession.update);
    await frontingSessionPersister.update(ctx, VALID_PAYLOAD, "fs_existing");
    const call = updateFn.mock.calls[0];
    expect(call?.[1]).toBe("fs_existing");
  });

  it("rejects payloads without a numeric startTime", async () => {
    const ctx = makeTestPersisterContext();
    await expect(frontingSessionPersister.create(ctx, { memberId: "mem_1" })).rejects.toThrow(
      /invalid payload for fronting-session/,
    );
  });
});
