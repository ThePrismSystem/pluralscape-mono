// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptGroupInput } from "@pluralscape/data/transforms/group";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { GroupRaw } from "@pluralscape/data/transforms/group";
import type { GroupId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastQueryOpts: CapturedOpts = {};
let lastInfiniteOpts: CapturedOpts = {};
let lastCreateOpts: CapturedOpts = {};
let lastUpdateOpts: CapturedOpts = {};
let lastDeleteOpts: CapturedOpts = {};
let lastAddMemberOpts: CapturedOpts = {};
let lastRemoveMemberOpts: CapturedOpts = {};
let lastReorderOpts: CapturedOpts = {};

const mockUtils = {
  group: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    listMembers: { invalidate: vi.fn() },
  },
  member: {
    listMemberships: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    group: {
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
          lastCreateOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      addMember: {
        useMutation: (opts: CapturedOpts) => {
          lastAddMemberOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      removeMember: {
        useMutation: (opts: CapturedOpts) => {
          lastRemoveMemberOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      reorder: {
        useMutation: (opts: CapturedOpts) => {
          lastReorderOpts = opts;
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

const { useMasterKey } = await import("../../providers/crypto-provider.js");
const {
  useGroup,
  useGroupsList,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAddGroupMembers,
  useRemoveGroupMembers,
  useReorderGroups,
} = await import("../use-groups.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawGroup(id: string): GroupRaw {
  const encrypted = encryptGroupInput(
    {
      name: `Group ${id}`,
      description: "A test group",
      imageSource: null,
      color: null,
      emoji: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as GroupId,
    systemId: TEST_SYSTEM_ID,
    parentGroupId: null,
    sortOrder: 0,
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useGroup", () => {
  it("enables when masterKey is present", () => {
    useGroup("g-1" as GroupId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useGroup("g-1" as GroupId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw group correctly", () => {
    useGroup("g-1" as GroupId);
    const select = lastQueryOpts["select"] as (raw: GroupRaw) => unknown;
    const raw = makeRawGroup("g-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["name"]).toBe("Group g-1");
    expect(result["description"]).toBe("A test group");
    expect(result["id"]).toBe("g-1");
  });
});

describe("useGroupsList", () => {
  it("select decrypts each page item", () => {
    useGroupsList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawGroup("g-1");
    const raw2 = makeRawGroup("g-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["name"]).toBe("Group g-1");
    expect(result.pages[0].data[1]["name"]).toBe("Group g-2");
  });
});

describe("useCreateGroup", () => {
  it("invalidates list on success", () => {
    mockUtils.group.list.invalidate.mockClear();
    useCreateGroup();
    const onSuccess = lastCreateOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateGroup", () => {
  it("invalidates get and list on success", () => {
    mockUtils.group.get.invalidate.mockClear();
    mockUtils.group.list.invalidate.mockClear();
    useUpdateGroup();
    const onSuccess = lastUpdateOpts["onSuccess"] as (
      data: unknown,
      variables: { groupId: string },
    ) => void;
    onSuccess(undefined, { groupId: "g-1" });
    expect(mockUtils.group.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "g-1",
    });
    expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteGroup", () => {
  it("invalidates get and list on success", () => {
    mockUtils.group.get.invalidate.mockClear();
    mockUtils.group.list.invalidate.mockClear();
    useDeleteGroup();
    const onSuccess = lastDeleteOpts["onSuccess"] as (
      data: unknown,
      variables: { groupId: string },
    ) => void;
    onSuccess(undefined, { groupId: "g-2" });
    expect(mockUtils.group.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "g-2",
    });
    expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useAddGroupMembers", () => {
  it("invalidates listMembers and listMemberships on success", () => {
    mockUtils.group.listMembers.invalidate.mockClear();
    mockUtils.member.listMemberships.invalidate.mockClear();
    useAddGroupMembers();
    const onSuccess = lastAddMemberOpts["onSuccess"] as (
      data: unknown,
      variables: { groupId: string; memberId: string },
    ) => void;
    onSuccess(undefined, { groupId: "g-1", memberId: "m-1" });
    expect(mockUtils.group.listMembers.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "g-1",
    });
    expect(mockUtils.member.listMemberships.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "m-1",
    });
  });
});

describe("useRemoveGroupMembers", () => {
  it("invalidates listMembers and listMemberships on success", () => {
    mockUtils.group.listMembers.invalidate.mockClear();
    mockUtils.member.listMemberships.invalidate.mockClear();
    useRemoveGroupMembers();
    const onSuccess = lastRemoveMemberOpts["onSuccess"] as (
      data: unknown,
      variables: { groupId: string; memberId: string },
    ) => void;
    onSuccess(undefined, { groupId: "g-2", memberId: "m-2" });
    expect(mockUtils.group.listMembers.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      groupId: "g-2",
    });
    expect(mockUtils.member.listMemberships.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      memberId: "m-2",
    });
  });
});

describe("useReorderGroups", () => {
  it("invalidates list on success", () => {
    mockUtils.group.list.invalidate.mockClear();
    useReorderGroups();
    const onSuccess = lastReorderOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.group.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
