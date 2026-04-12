import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import { journalEntryPersister } from "../journal-entry.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const VALID_PAYLOAD = {
  encrypted: {
    title: "First entry",
    content: "hello",
    backgroundColor: null,
  },
  author: { entityType: "member" as const, entityId: "mem_1" },
  createdAt: 1_700_000_000_000,
};

describe("journalEntryPersister", () => {
  it("create encrypts and calls note.create", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.note.create);
    const result = await journalEntryPersister.create(ctx, VALID_PAYLOAD);
    expect(createFn).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ encryptedData: expect.any(String) }),
    );
    expect(result.pluralscapeEntityId).toBe("note_1");
  });

  it("update targets the existing note ID", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.note.update);
    await journalEntryPersister.update(ctx, VALID_PAYLOAD, "note_existing");
    const call = updateFn.mock.calls[0];
    expect(call?.[1]).toBe("note_existing");
  });

  it("rejects payloads without content", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      journalEntryPersister.create(ctx, { encrypted: { title: "no content" } }),
    ).rejects.toThrow(/invalid payload for journal-entry/);
  });
});
