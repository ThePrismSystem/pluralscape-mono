import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  TEST_SYSTEM_ID,
  makeTestMasterKey,
  makeTestIdTranslation,
  makeTestPersisterContext,
} from "../../__tests__/persister-test-helpers.js";
import {
  assertPayloadShape,
  castPollVotes,
  encryptForCreate,
  encryptForUpdate,
  persistViaChannelsTable,
  queueRefUpsert,
  resolveExistingId,
} from "../persister-helpers.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixtures ─────────────────────────────────────────────────────────

const TEST_MASTER_KEY = makeTestMasterKey();

const TEST_POLL_VERSION = 1;
const TEST_SORT_ORDER = 5;

// ── resolveExistingId ────────────────────────────────────────────────

describe("resolveExistingId", () => {
  it("returns null when the source ID has no mapping", () => {
    const table = makeTestIdTranslation();
    expect(resolveExistingId(table, "member", "sp_abc")).toBeNull();
  });

  it("returns the cached Pluralscape ID on a hit", () => {
    const table = makeTestIdTranslation();
    table.set("member", "sp_abc", "mem_123");
    expect(resolveExistingId(table, "member", "sp_abc")).toBe("mem_123");
  });

  it("keeps separate namespaces per entity type", () => {
    const table = makeTestIdTranslation();
    table.set("member", "shared_id", "mem_123");
    table.set("group", "shared_id", "grp_456");
    expect(resolveExistingId(table, "member", "shared_id")).toBe("mem_123");
    expect(resolveExistingId(table, "group", "shared_id")).toBe("grp_456");
  });
});

// ── assertPayloadShape ───────────────────────────────────────────────

interface NamedThing {
  readonly name: string;
}

function isNamedThing(value: unknown): value is NamedThing {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

describe("assertPayloadShape", () => {
  it("returns the narrowed value when the guard passes", () => {
    const payload: unknown = { name: "Aurora" };
    const narrowed = assertPayloadShape(payload, isNamedThing, "member");
    expect(narrowed.name).toBe("Aurora");
  });

  it("throws a descriptive error when the guard rejects", () => {
    const payload: unknown = { name: 42 };
    expect(() => assertPayloadShape(payload, isNamedThing, "member")).toThrow(
      /invalid payload for member/,
    );
  });

  it("throws on null", () => {
    expect(() => assertPayloadShape(null, isNamedThing, "poll")).toThrow(
      /invalid payload for poll/,
    );
  });
});

// ── encrypt wrappers ─────────────────────────────────────────────────

describe("encryptForCreate / encryptForUpdate", () => {
  it("produces an encryptedData string for create", () => {
    const out = encryptForCreate({ foo: "bar" }, TEST_MASTER_KEY);
    expect(typeof out.encryptedData).toBe("string");
    expect(out.encryptedData.length).toBeGreaterThan(0);
  });

  it("includes the version for update", () => {
    const out = encryptForUpdate({ foo: "bar" }, TEST_POLL_VERSION, TEST_MASTER_KEY);
    expect(out.version).toBe(TEST_POLL_VERSION);
    expect(typeof out.encryptedData).toBe("string");
  });

  it("produces distinct ciphertexts for the same plaintext (nonce randomness)", () => {
    const a = encryptForCreate({ foo: "bar" }, TEST_MASTER_KEY);
    const b = encryptForCreate({ foo: "bar" }, TEST_MASTER_KEY);
    expect(a.encryptedData).not.toBe(b.encryptedData);
  });
});

// ── persistViaChannelsTable ──────────────────────────────────────────

describe("persistViaChannelsTable", () => {
  it("writes with type=category for category payloads", async () => {
    const ctx = makeTestPersisterContext();
    const channelCreate = vi.mocked(ctx.api.channel.create);
    await persistViaChannelsTable(
      ctx,
      { encryptedData: "enc", parentId: null, sortOrder: TEST_SORT_ORDER },
      "category",
    );
    expect(channelCreate).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ type: "category", parentId: null }),
    );
  });

  it("writes with type=channel and a resolved parent", async () => {
    const ctx = makeTestPersisterContext();
    const channelCreate = vi.mocked(ctx.api.channel.create);
    await persistViaChannelsTable(
      ctx,
      { encryptedData: "enc", parentId: "ch_parent", sortOrder: TEST_SORT_ORDER },
      "channel",
    );
    expect(channelCreate).toHaveBeenCalledWith(
      TEST_SYSTEM_ID,
      expect.objectContaining({ type: "channel", parentId: "ch_parent" }),
    );
  });
});

// ── castPollVotes ────────────────────────────────────────────────────

describe("castPollVotes", () => {
  it("fans out one castVote call per vote in order", async () => {
    const ctx = makeTestPersisterContext();
    const castVote = vi.mocked(ctx.api.poll.castVote);
    await castPollVotes(ctx, "poll_1", [
      { optionId: "opt_a", memberId: "mem_1", isVeto: false, comment: null },
      { optionId: "opt_b", memberId: null, isVeto: false, comment: "abstain" },
      { optionId: "", memberId: null, isVeto: true, comment: null },
    ]);
    expect(castVote).toHaveBeenCalledTimes(3);
    expect(castVote).toHaveBeenNthCalledWith(
      1,
      TEST_SYSTEM_ID,
      expect.objectContaining({ pollId: "poll_1", memberId: "mem_1" }),
    );
    expect(castVote).toHaveBeenNthCalledWith(
      2,
      TEST_SYSTEM_ID,
      expect.objectContaining({ pollId: "poll_1", memberId: null }),
    );
    expect(castVote).toHaveBeenNthCalledWith(
      3,
      TEST_SYSTEM_ID,
      expect.objectContaining({ pollId: "poll_1", memberId: null }),
    );
  });

  it("resolves to undefined with no votes and makes zero calls", async () => {
    const ctx = makeTestPersisterContext();
    const castVote = vi.mocked(ctx.api.poll.castVote);
    await expect(castPollVotes(ctx, "poll_1", [])).resolves.toBeUndefined();
    expect(castVote).not.toHaveBeenCalled();
  });
});

// ── queueRefUpsert ───────────────────────────────────────────────────

describe("queueRefUpsert", () => {
  it("delegates to the context's queueRefUpsert", () => {
    const ctx = makeTestPersisterContext();
    const queue = vi.mocked(ctx.queueRefUpsert);
    queueRefUpsert(ctx, "member", "sp_abc", "mem_123");
    expect(queue).toHaveBeenCalledWith("member", "sp_abc", "mem_123");
  });
});
