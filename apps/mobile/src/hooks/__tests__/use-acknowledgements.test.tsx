// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptAcknowledgementInput } from "@pluralscape/data/transforms/acknowledgement";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { AcknowledgementRaw } from "@pluralscape/data/transforms/acknowledgement";
import type { AcknowledgementId, MemberId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  acknowledgement: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      acknowledgement: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["acknowledgement.get", input],
              queryFn: () => Promise.resolve(fixtures.get("acknowledgement.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["acknowledgement.list", input],
              queryFn: () => Promise.resolve(fixtures.get("acknowledgement.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        confirm: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        archive: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        restore: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        delete: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useAcknowledgement,
  useAcknowledgementsList,
  useCreateAcknowledgement,
  useConfirmAcknowledgement,
  useArchiveAcknowledgement,
  useRestoreAcknowledgement,
  useDeleteAcknowledgement,
} = await import("../use-acknowledgements.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawAcknowledgement(id: string): AcknowledgementRaw {
  const encrypted = encryptAcknowledgementInput(
    {
      message: "Please read",
      targetMemberId: brandId<MemberId>("m-1"),
      confirmedAt: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<AcknowledgementId>(id),
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    confirmed: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useAcknowledgement", () => {
  it("returns decrypted acknowledgement data", async () => {
    fixtures.set("acknowledgement.get", makeRawAcknowledgement("ack-1"));
    const { result } = renderHookWithProviders(() =>
      useAcknowledgement(brandId<AcknowledgementId>("ack-1")),
    );

    let data: Awaited<ReturnType<typeof useAcknowledgement>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.message).toBe("Please read");
    expect(data?.targetMemberId).toBe("m-1");
    expect(data?.confirmedAt).toBeNull();
    expect(data?.confirmed).toBe(false);
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useAcknowledgement(brandId<AcknowledgementId>("ack-1")),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("acknowledgement.get", makeRawAcknowledgement("ack-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useAcknowledgement(brandId<AcknowledgementId>("ack-1")),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useAcknowledgementsList", () => {
  it("returns decrypted paginated acknowledgements", async () => {
    const raw1 = makeRawAcknowledgement("ack-1");
    const raw2 = makeRawAcknowledgement("ack-2");
    fixtures.set("acknowledgement.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useAcknowledgementsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.message).toBe("Please read");
    expect(pages[0]?.data[1]?.message).toBe("Please read");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useAcknowledgementsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("acknowledgement.list", {
      data: [makeRawAcknowledgement("ack-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useAcknowledgementsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateAcknowledgement", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateAcknowledgement());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useConfirmAcknowledgement", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useConfirmAcknowledgement());

    await act(() => result.current.mutateAsync({ ackId: "ack-1" } as never));

    await waitFor(() => {
      expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        ackId: "ack-1",
      });
      expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveAcknowledgement", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveAcknowledgement());

    await act(() => result.current.mutateAsync({ ackId: "ack-2" } as never));

    await waitFor(() => {
      expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        ackId: "ack-2",
      });
      expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreAcknowledgement", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreAcknowledgement());

    await act(() => result.current.mutateAsync({ ackId: "ack-3" } as never));

    await waitFor(() => {
      expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        ackId: "ack-3",
      });
      expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteAcknowledgement", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteAcknowledgement());

    await act(() => result.current.mutateAsync({ ackId: "ack-4" } as never));

    await waitFor(() => {
      expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        ackId: "ack-4",
      });
      expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

// ── Local source mode tests ───────────────────────────────────────────
function createMockLocalDb(rows: Record<string, unknown>[]) {
  return {
    initialize: vi.fn(),
    queryAll: vi.fn().mockReturnValue(rows),
    queryOne: vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
      const id = params[0];
      return rows.find((r) => r["id"] === id);
    }),
    execute: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  };
}

const LOCAL_ACK_ROW: Record<string, unknown> = {
  id: "ack-local-1",
  system_id: TEST_SYSTEM_ID,
  created_by_member_id: "m-1",
  target_member_id: "m-2",
  message: "Please acknowledge this",
  confirmed: 0,
  confirmed_at: null,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useAcknowledgement (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_ACK_ROW]);
    const { result } = renderHookWithProviders(
      () => useAcknowledgement(brandId<AcknowledgementId>("ack-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("own_acknowledgements"), [
      "ack-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "ack-local-1",
      message: "Please acknowledge this",
      targetMemberId: "m-2",
      confirmed: false,
      archived: false,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_ACK_ROW]);
    const { result } = renderHookWithProviders(
      () => useAcknowledgement(brandId<AcknowledgementId>("ack-local-1")),
      { querySource: "local", localDb },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.message).toBe("Please acknowledge this");
  });
});

describe("useAcknowledgementsList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_ACK_ROW, id: "ack-local-2", message: "Second ack" };
    const localDb = createMockLocalDb([LOCAL_ACK_ROW, row2]);
    const { result } = renderHookWithProviders(() => useAcknowledgementsList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("own_acknowledgements"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ message: "Please acknowledge this" });
    expect(items[1]).toMatchObject({ message: "Second ack" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_ACK_ROW]);
    const { result } = renderHookWithProviders(() => useAcknowledgementsList(), {
      querySource: "local",
      localDb,
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(1);
  });
});
