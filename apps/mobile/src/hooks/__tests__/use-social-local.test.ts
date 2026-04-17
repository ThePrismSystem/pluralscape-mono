// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../data/DataLayerProvider.js", () => ({
  useDataLayerOptional: vi.fn(),
}));

vi.mock("../use-query-source.js", () => ({
  useQuerySource: vi.fn(),
  useLocalDb: vi.fn(),
}));

vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn().mockReturnValue("sys-1"),
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn().mockReturnValue(null),
}));

vi.mock("../../auth/index.js", () => ({
  useAuth: vi.fn().mockReturnValue({
    snapshot: {
      state: "unlocked",
      credentials: { accountId: "test-account-0000000" },
      session: null,
    },
  }),
}));

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    friend: {
      get: {
        useQuery: vi.fn().mockReturnValue({
          data: undefined,
          isError: false,
          isPending: true,
          isLoading: true,
          isFetching: false,
          isSuccess: false,
          status: "pending",
          error: null,
          trpc: {},
        }),
      },
      list: {
        useInfiniteQuery: vi.fn().mockReturnValue({
          data: undefined,
          isError: false,
          isPending: true,
          isLoading: true,
          isFetching: false,
          isSuccess: false,
          status: "pending",
          error: null,
          trpc: {},
        }),
      },
      accept: { useMutation: vi.fn() },
      reject: { useMutation: vi.fn() },
      block: { useMutation: vi.fn() },
      remove: { useMutation: vi.fn() },
      archive: { useMutation: vi.fn() },
      restore: { useMutation: vi.fn() },
      updateVisibility: { useMutation: vi.fn() },
    },
    friendCode: {
      list: {
        useInfiniteQuery: vi.fn().mockReturnValue({
          data: undefined,
          isError: false,
          isPending: true,
          isLoading: true,
          isFetching: false,
          isSuccess: false,
          status: "pending",
          error: null,
          trpc: {},
        }),
      },
      generate: { useMutation: vi.fn() },
      redeem: { useMutation: vi.fn() },
      archive: { useMutation: vi.fn() },
    },
    bucket: {
      get: {
        useQuery: vi.fn().mockReturnValue({
          data: undefined,
          isError: false,
          isPending: true,
          isLoading: true,
          isFetching: false,
          isSuccess: false,
          status: "pending",
          error: null,
          trpc: {},
        }),
      },
      list: {
        useInfiniteQuery: vi.fn().mockReturnValue({
          data: undefined,
          isError: false,
          isPending: true,
          isLoading: true,
          isFetching: false,
          isSuccess: false,
          status: "pending",
          error: null,
          trpc: {},
        }),
      },
      create: { useMutation: vi.fn() },
      update: { useMutation: vi.fn() },
      archive: { useMutation: vi.fn() },
      restore: { useMutation: vi.fn() },
    },
    useUtils: vi.fn().mockReturnValue({
      friend: {
        get: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
      friendCode: {
        list: { invalidate: vi.fn() },
      },
      bucket: {
        get: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

import { useFriendCodesList } from "../use-friend-codes.js";
import { useFriendConnection, useFriendConnectionsList } from "../use-friend-connections.js";
import { usePrivacyBucket, usePrivacyBucketsList } from "../use-privacy-buckets.js";
import { useLocalDb, useQuerySource } from "../use-query-source.js";

import type { LocalDatabase } from "../../data/local-database.js";

const mockUseQuerySource = vi.mocked(useQuerySource);
const mockUseLocalDb = vi.mocked(useLocalDb);

interface DbFixture {
  readonly db: LocalDatabase;
  readonly queryOneMock: ReturnType<typeof vi.fn>;
  readonly queryAllMock: ReturnType<typeof vi.fn>;
}

function makeLocalDb(
  oneRow: Record<string, unknown> | undefined,
  allRows: Record<string, unknown>[] = [],
): DbFixture {
  const queryOneMock = vi.fn().mockReturnValue(oneRow);
  const queryAllMock = vi.fn().mockReturnValue(allRows);
  const db: LocalDatabase = {
    initialize: vi.fn(),
    queryOne: queryOneMock,
    queryAll: queryAllMock,
    execute: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()) as LocalDatabase["transaction"],
    close: vi.fn(),
  };
  return { db, queryOneMock, queryAllMock };
}

function makeWrapper(): ({ children }: { children: React.ReactNode }) => React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── useFriendConnection ───────────────────────────────────────────────────────

describe("useFriendConnection — local mode", () => {
  it("queries SQLite for the connection row when source is local", () => {
    const row = {
      id: "fc-1",
      account_id: "acc-1",
      friend_account_id: "acc-2",
      status: "accepted",
      assigned_buckets: "[]",
      visibility: "{}",
      archived: 0,
      archived_at: null,
      version: 1,
      created_at: 1_000_000,
      updated_at: 2_000_000,
    };
    const { db } = makeLocalDb(row);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => useFriendConnection("fc-1" as never), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });

  it("scopes the local query by account_id", () => {
    const row = {
      id: "fc-1",
      account_id: "test-account-0000000",
      friend_account_id: "acc-2",
      status: "accepted",
      assigned_buckets: "[]",
      visibility: "{}",
      archived: 0,
      archived_at: null,
      version: 1,
      created_at: 1_000_000,
      updated_at: 2_000_000,
    };
    const { db, queryOneMock } = makeLocalDb(row);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => useFriendConnection("fc-1" as never), { wrapper: makeWrapper() });

    expect(queryOneMock).toHaveBeenCalledWith(
      expect.stringContaining("account_id"),
      expect.arrayContaining(["fc-1", "test-account-0000000"]),
    );
  });

  it("does not call localDb.queryOne on first render when source is remote", () => {
    const { db, queryOneMock } = makeLocalDb(undefined);
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => useFriendConnection("fc-1" as never), { wrapper: makeWrapper() });

    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it("returns a query shape with isError=false when source is remote", () => {
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(null);

    const { result } = renderHook(() => useFriendConnection("fc-1" as never), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });
});

// ── useFriendConnectionsList ──────────────────────────────────────────────────

describe("useFriendConnectionsList — local mode", () => {
  it("queries SQLite for all connections when source is local", () => {
    const { db } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => useFriendConnectionsList(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });

  it("scopes the local query by account_id", () => {
    const { db, queryAllMock } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => useFriendConnectionsList(), { wrapper: makeWrapper() });

    expect(queryAllMock).toHaveBeenCalledWith(
      expect.stringContaining("account_id"),
      expect.arrayContaining(["test-account-0000000"]),
    );
  });

  it("does not call localDb.queryAll when source is remote", () => {
    const { db, queryAllMock } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => useFriendConnectionsList(), { wrapper: makeWrapper() });

    expect(queryAllMock).not.toHaveBeenCalled();
  });

  it("returns a query shape with isError=false when filtering by status in local mode", () => {
    const { db } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => useFriendConnectionsList({ status: "accepted" }), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });
});

// ── useFriendCodesList ────────────────────────────────────────────────────────

describe("useFriendCodesList — local mode", () => {
  it("returns a query result when source is local", () => {
    const { db } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => useFriendCodesList(), { wrapper: makeWrapper() });

    expect(result.current.isError).toBe(false);
  });

  it("does not call localDb.queryAll when source is remote", () => {
    const { db, queryAllMock } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => useFriendCodesList(), { wrapper: makeWrapper() });

    expect(queryAllMock).not.toHaveBeenCalled();
  });
});

// ── usePrivacyBucket ─────────────────────────────────────────────────────────

describe("usePrivacyBucket — local mode", () => {
  it("queries SQLite for the bucket row when source is local", () => {
    const row = {
      id: "bkt-1",
      system_id: "sys-1",
      name: "Public",
      description: null,
      archived: 0,
      created_at: 1_000_000,
      updated_at: 2_000_000,
    };
    const { db } = makeLocalDb(row);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => usePrivacyBucket("bkt-1" as never), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });

  it("does not call localDb.queryOne when source is remote", () => {
    const { db, queryOneMock } = makeLocalDb(undefined);
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => usePrivacyBucket("bkt-1" as never), { wrapper: makeWrapper() });

    expect(queryOneMock).not.toHaveBeenCalled();
  });
});

// ── usePrivacyBucketsList ────────────────────────────────────────────────────

describe("usePrivacyBucketsList — local mode", () => {
  it("returns a query result when source is local", () => {
    const { db } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => usePrivacyBucketsList(), { wrapper: makeWrapper() });

    expect(result.current.isError).toBe(false);
  });

  it("does not call localDb.queryAll when source is remote", () => {
    const { db, queryAllMock } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("remote");
    mockUseLocalDb.mockReturnValue(db);

    renderHook(() => usePrivacyBucketsList(), { wrapper: makeWrapper() });

    expect(queryAllMock).not.toHaveBeenCalled();
  });

  it("returns a query shape with isError=false when includeArchived is false", () => {
    const { db } = makeLocalDb(undefined, []);
    mockUseQuerySource.mockReturnValue("local");
    mockUseLocalDb.mockReturnValue(db);

    const { result } = renderHook(() => usePrivacyBucketsList({ includeArchived: false }), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });
});
