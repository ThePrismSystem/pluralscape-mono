// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptFrontingCommentInput } from "@pluralscape/data/transforms/fronting-comment";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { FrontingCommentRaw } from "@pluralscape/data/transforms/fronting-comment";
import type {
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  UnixMillis,
} from "@pluralscape/types";

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
let lastGetOpts: CapturedOpts = {};
let lastListOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};

const mockUtils = {
  frontingComment: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    frontingComment: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastGetOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastListOpts = opts;
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
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteMutationOpts = opts;
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
  useFrontingComment,
  useFrontingCommentsList,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} = await import("../use-fronting-comments.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const SESSION_ID = "fs-1" as FrontingSessionId;

function makeRawComment(id: string): FrontingCommentRaw {
  const encrypted = encryptFrontingCommentInput({ content: `Comment ${id}` }, TEST_MASTER_KEY);
  return {
    id: id as FrontingCommentId,
    frontingSessionId: SESSION_ID,
    systemId: TEST_SYSTEM_ID,
    memberId: "m-1" as MemberId,
    customFrontId: null,
    structureEntityId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useFrontingComment", () => {
  it("enables when masterKey is present", () => {
    useFrontingComment("fc-1" as FrontingCommentId, SESSION_ID);
    expect(lastGetOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useFrontingComment("fc-1" as FrontingCommentId, SESSION_ID);
    expect(lastGetOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw comment correctly", () => {
    useFrontingComment("fc-1" as FrontingCommentId, SESSION_ID);
    const select = lastGetOpts["select"] as (raw: FrontingCommentRaw) => unknown;
    const raw = makeRawComment("fc-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["content"]).toBe("Comment fc-1");
    expect(result["frontingSessionId"]).toBe(SESSION_ID);
    expect(result["archived"]).toBe(false);
  });
});

describe("useFrontingCommentsList", () => {
  it("select decrypts each page item", () => {
    useFrontingCommentsList(SESSION_ID);
    const select = lastListOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawComment("fc-1");
    const raw2 = makeRawComment("fc-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["content"]).toBe("Comment fc-1");
    expect(result.pages[0].data[1]["content"]).toBe("Comment fc-2");
  });
});

describe("useCreateComment", () => {
  it("invalidates list onSuccess", () => {
    mockUtils.frontingComment.list.invalidate.mockClear();
    useCreateComment();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { sessionId: string },
    ) => void;
    onSuccess(undefined, { sessionId: SESSION_ID });
    expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: SESSION_ID,
    });
  });
});

describe("useUpdateComment", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.frontingComment.get.invalidate.mockClear();
    mockUtils.frontingComment.list.invalidate.mockClear();
    useUpdateComment();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { commentId: string; sessionId: string },
    ) => void;
    onSuccess(undefined, { commentId: "fc-1", sessionId: SESSION_ID });
    expect(mockUtils.frontingComment.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: SESSION_ID,
      commentId: "fc-1",
    });
    expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: SESSION_ID,
    });
  });
});

describe("useDeleteComment", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.frontingComment.get.invalidate.mockClear();
    mockUtils.frontingComment.list.invalidate.mockClear();
    useDeleteComment();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { commentId: string; sessionId: string },
    ) => void;
    onSuccess(undefined, { commentId: "fc-2", sessionId: SESSION_ID });
    expect(mockUtils.frontingComment.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: SESSION_ID,
      commentId: "fc-2",
    });
    expect(mockUtils.frontingComment.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      sessionId: SESSION_ID,
    });
  });
});
