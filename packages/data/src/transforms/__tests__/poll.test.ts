import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptPoll,
  decryptPollPage,
  decryptPollVote,
  encryptPollInput,
  encryptPollUpdate,
  encryptPollVoteInput,
} from "../poll.js";

import { makeBase64Blob } from "./helpers.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  EntityReference,
  HexColor,
  MemberId,
  PollEncryptedInput,
  PollId,
  PollKind,
  PollOption,
  PollOptionId,
  PollStatus,
  PollVoteEncryptedInput,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

// ── Poll fixtures ─────────────────────────────────────────────────────

function makePollOption(id: string): PollOption {
  return {
    id: brandId<PollOptionId>(id),
    label: `Option ${id}`,
    voteCount: 0,
    color: "#aabbcc" as HexColor,
    emoji: null,
  };
}

function makePollEncryptedInput(): PollEncryptedInput {
  return {
    title: "Best snack?",
    description: "Vote for your favourite.",
    options: [makePollOption("opt_001"), makePollOption("opt_002")],
  };
}

function makeServerPoll(
  fields: PollEncryptedInput = makePollEncryptedInput(),
  overrides?: Partial<{ archived: boolean; archivedAt: UnixMillis | null }>,
) {
  return {
    id: brandId<PollId>("poll_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    createdByMemberId: brandId<MemberId>("mem_creator"),
    kind: "custom" as PollKind,
    status: "open" as PollStatus,
    closedAt: null as UnixMillis | null,
    endsAt: null as UnixMillis | null,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: true,
    allowVeto: false,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

// ── PollVote fixtures ─────────────────────────────────────────────────

function makePollVoteEncryptedInput(): PollVoteEncryptedInput {
  return { comment: "Great option!" };
}

function makeServerPollVote(overrides?: {
  encryptedData?: string;
  archived?: boolean;
  archivedAt?: UnixMillis | null;
  voter?: EntityReference<"member" | "structure-entity"> | null;
  optionId?: PollOptionId | null;
}) {
  return {
    id: brandId<PollVoteId>("pv_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    pollId: brandId<PollId>("poll_abc123"),
    optionId: brandId<PollOptionId>("opt_001") as PollOptionId | null,
    voter: { entityType: "member" as const, entityId: "mem_voter" } as EntityReference<
      "member" | "structure-entity"
    >,
    isVeto: false,
    votedAt: toUnixMillis(1_700_000_500_000),
    encryptedData: encryptAndEncodeT1(makePollVoteEncryptedInput(), masterKey),
    version: 1,
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    createdAt: toUnixMillis(1_700_000_500_000),
    updatedAt: toUnixMillis(1_700_000_500_000),
    ...overrides,
  };
}

// ── decryptPoll ───────────────────────────────────────────────────────

describe("decryptPoll", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerPoll();
    const result = decryptPoll(raw, masterKey);

    expect(result.id).toBe("poll_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.createdByMemberId).toBe("mem_creator");
    expect(result.kind).toBe("custom");
    expect(result.status).toBe("open");
    expect(result.allowMultipleVotes).toBe(false);
    expect(result.maxVotesPerMember).toBe(1);
    expect(result.allowAbstain).toBe(true);
    expect(result.allowVeto).toBe(false);
    expect(result.version).toBe(1);
    expect(result.archived).toBe(false);
    expect(result.title).toBe("Best snack?");
    expect(result.description).toBe("Vote for your favourite.");
    expect(result.options).toHaveLength(2);
  });

  it("handles null description", () => {
    const fields: PollEncryptedInput = { title: "Yes/No?", description: null, options: [] };
    const result = decryptPoll(makeServerPoll(fields), masterKey);
    expect(result.description).toBeNull();
    expect(result.options).toEqual([]);
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerPoll(), encryptedData: "!!!" };
    expect(() => decryptPoll(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerPoll(makePollEncryptedInput(), { archived: true, archivedAt });
    const result = decryptPoll(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerPoll(makePollEncryptedInput(), { archived: true, archivedAt: null });
    expect(() => decryptPoll(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── decryptPollPage ───────────────────────────────────────────────────

describe("decryptPollPage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerPoll(), makeServerPoll()];
    const result = decryptPollPage({ data, nextCursor: "poll_cursor" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("poll_cursor");
    result.data.forEach((p) => {
      expect(p.title).toBe("Best snack?");
    });
  });

  it("handles null cursor and empty data", () => {
    const result = decryptPollPage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptPollInput ──────────────────────────────────────────────────

describe("encryptPollInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptPollInput(makePollEncryptedInput(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makePollEncryptedInput();
    const { encryptedData } = encryptPollInput(fields, masterKey);
    const result = decryptPoll({ ...makeServerPoll(), encryptedData }, masterKey);

    expect(result.title).toBe(fields.title);
    expect(result.description).toBe(fields.description);
    expect(result.options).toEqual(fields.options);
  });
});

// ── encryptPollUpdate ─────────────────────────────────────────────────

describe("encryptPollUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptPollUpdate(makePollEncryptedInput(), 2, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(2);
  });

  it("round-trips through decryptPoll", () => {
    const fields = makePollEncryptedInput();
    const { encryptedData } = encryptPollUpdate(fields, 3, masterKey);
    const result = decryptPoll({ ...makeServerPoll(), encryptedData, version: 3 }, masterKey);
    expect(result.title).toBe(fields.title);
  });
});

// ── decryptPollVote ───────────────────────────────────────────────────

describe("decryptPollVote", () => {
  it("decrypts comment from encrypted blob and passes through transparent fields", () => {
    const raw = makeServerPollVote();
    const result = decryptPollVote(raw, masterKey);

    expect(result.id).toBe("pv_abc123");
    expect(result.pollId).toBe("poll_abc123");
    expect(result.optionId).toBe("opt_001");
    expect(result.isVeto).toBe(false);
    expect(result.archived).toBe(false);
    expect(result.comment).toBe("Great option!");
  });

  it("handles null optionId (abstain vote)", () => {
    const raw = { ...makeServerPollVote(), optionId: null };
    const result = decryptPollVote(raw, masterKey);
    expect(result.optionId).toBeNull();
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = makeServerPollVote({ encryptedData: "corrupt!!!" });
    expect(() => decryptPollVote(raw, masterKey)).toThrow();
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerPollVote({ archived: true, archivedAt });
    const result = decryptPollVote(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerPollVote({ archived: true, archivedAt: null });
    expect(() => decryptPollVote(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── encryptPollVoteInput ──────────────────────────────────────────────

describe("encryptPollVoteInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptPollVoteInput(makePollVoteEncryptedInput(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original comment", () => {
    const fields = makePollVoteEncryptedInput();
    const { encryptedData } = encryptPollVoteInput(fields, masterKey);
    const raw = makeServerPollVote({ encryptedData });
    const result = decryptPollVote(raw, masterKey);
    expect(result.comment).toBe("Great option!");
  });

  it("round-trips null comment", () => {
    const fields: PollVoteEncryptedInput = { comment: null };
    const { encryptedData } = encryptPollVoteInput(fields, masterKey);
    const raw = makeServerPollVote({ encryptedData });
    const result = decryptPollVote(raw, masterKey);
    expect(result.comment).toBeNull();
  });
});

// ── PollEncryptedInputSchema ─────────────────────────────────────────

describe("PollEncryptedInputSchema validation", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = { ...makeServerPoll(), encryptedData: makeBase64Blob("not-object", masterKey) };
    expect(() => decryptPoll(raw, masterKey)).toThrow(/object/);
  });

  it("throws when blob is missing title field", () => {
    const raw = {
      ...makeServerPoll(),
      encryptedData: makeBase64Blob({ options: [] }, masterKey),
    };
    expect(() => decryptPoll(raw, masterKey)).toThrow(/title/);
  });

  it("throws when blob is missing options array", () => {
    const raw = {
      ...makeServerPoll(),
      encryptedData: makeBase64Blob({ title: "A poll" }, masterKey),
    };
    expect(() => decryptPoll(raw, masterKey)).toThrow(/options/);
  });
});
