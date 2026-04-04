// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptMemberInput } from "@pluralscape/data/transforms/member";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { MemberRaw } from "@pluralscape/data/transforms/member";
import type { MemberId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// Passthrough useCallback so hooks can run outside a React render cycle
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastQueryOpts: CapturedOpts = {};
let lastInfiniteOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};
let lastArchiveMutationOpts: CapturedOpts = {};
let lastRestoreMutationOpts: CapturedOpts = {};
let lastDuplicateMutationOpts: CapturedOpts = {};

const mockUtils = {
  member: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    listMemberships: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    member: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastQueryOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastInfiniteOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      archive: {
        useMutation: (opts: CapturedOpts) => {
          lastArchiveMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      restore: {
        useMutation: (opts: CapturedOpts) => {
          lastRestoreMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      duplicate: {
        useMutation: (opts: CapturedOpts) => {
          lastDuplicateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn(() => TEST_MASTER_KEY),
}));
vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

// Must import AFTER vi.mock
const { useMasterKey } = await import("../../providers/crypto-provider.js");
const {
  useMember,
  useMembersList,
  useCreateMember,
  useUpdateMember,
  useArchiveMember,
  useRestoreMember,
  useDuplicateMember,
} = await import("../use-members.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawMember(id: string): MemberRaw {
  const encrypted = encryptMemberInput(
    {
      name: `Member ${id}`,
      pronouns: ["they/them"],
      description: "A test member",
      avatarSource: null,
      colors: [],
      saturationLevel: { kind: "known", level: "highly-elaborated" },
      tags: [],
      suppressFriendFrontNotification: false,
      boardMessageNotificationOnFront: false,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as MemberId,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useMember", () => {
  it("enables when masterKey is present", () => {
    useMember("m-1" as MemberId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useMember("m-1" as MemberId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw member correctly", () => {
    useMember("m-1" as MemberId);
    const select = lastQueryOpts["select"] as (raw: MemberRaw) => unknown;
    const raw = makeRawMember("m-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["name"]).toBe("Member m-1");
    expect(result["pronouns"]).toEqual(["they/them"]);
    expect(result["description"]).toBe("A test member");
    expect(result["archived"]).toBe(false);
  });
});

describe("useMembersList", () => {
  it("select decrypts each page item", () => {
    useMembersList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawMember("m-1");
    const raw2 = makeRawMember("m-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["name"]).toBe("Member m-1");
    expect(result.pages[0].data[1]["name"]).toBe("Member m-2");
  });
});

describe("useCreateMember", () => {
  it("invalidates list on success", () => {
    mockUtils.member.list.invalidate.mockClear();
    useCreateMember();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateMember", () => {
  it("invalidates get and list on success", () => {
    mockUtils.member.get.invalidate.mockClear();
    mockUtils.member.list.invalidate.mockClear();
    useUpdateMember();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { memberId: string },
    ) => void;
    onSuccess(undefined, { memberId: "m-1" });
    expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "m-1",
    });
    expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useArchiveMember", () => {
  it("invalidates get and list on success", () => {
    mockUtils.member.get.invalidate.mockClear();
    mockUtils.member.list.invalidate.mockClear();
    useArchiveMember();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { memberId: string },
    ) => void;
    onSuccess(undefined, { memberId: "m-2" });
    expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "m-2",
    });
    expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestoreMember", () => {
  it("invalidates get and list on success", () => {
    mockUtils.member.get.invalidate.mockClear();
    mockUtils.member.list.invalidate.mockClear();
    useRestoreMember();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { memberId: string },
    ) => void;
    onSuccess(undefined, { memberId: "m-3" });
    expect(mockUtils.member.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "m-3",
    });
    expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDuplicateMember", () => {
  it("invalidates list on success", () => {
    mockUtils.member.list.invalidate.mockClear();
    useDuplicateMember();
    const onSuccess = lastDuplicateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.member.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
