// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptNoteInput } from "@pluralscape/data/transforms/note";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { NoteRaw } from "@pluralscape/data/transforms/note";
import type { NoteId, UnixMillis } from "@pluralscape/types";

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
  note: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      note: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["note.get", input],
              queryFn: () => Promise.resolve(fixtures.get("note.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["note.list", input],
              queryFn: () => Promise.resolve(fixtures.get("note.list")),
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
        update: {
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
  useNote,
  useNotesList,
  useCreateNote,
  useUpdateNote,
  useArchiveNote,
  useRestoreNote,
  useDeleteNote,
} = await import("../use-notes.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawNote(id: string): NoteRaw {
  const encrypted = encryptNoteInput(
    { title: "Note", content: "Body", backgroundColor: null },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<NoteId>(id),
    systemId: TEST_SYSTEM_ID,
    authorEntityType: null,
    authorEntityId: null,
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
describe("useNote", () => {
  it("returns decrypted note data", async () => {
    fixtures.set("note.get", makeRawNote("note-1"));
    const { result } = renderHookWithProviders(() => useNote(brandId<NoteId>("note-1")));

    let data: Awaited<ReturnType<typeof useNote>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.title).toBe("Note");
    expect(data?.content).toBe("Body");
    expect(data?.backgroundColor).toBeNull();
    expect(data?.authorEntityType).toBeNull();
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useNote(brandId<NoteId>("note-1")), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("note.get", makeRawNote("note-1"));
    const { result, rerender } = renderHookWithProviders(() => useNote(brandId<NoteId>("note-1")));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useNotesList", () => {
  it("returns decrypted paginated notes", async () => {
    const raw1 = makeRawNote("note-1");
    const raw2 = makeRawNote("note-2");
    fixtures.set("note.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useNotesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.title).toBe("Note");
    expect(pages[0]?.data[1]?.title).toBe("Note");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useNotesList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("note.list", { data: [makeRawNote("note-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => useNotesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateNote", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateNote());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateNote", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateNote());

    await act(() => result.current.mutateAsync({ noteId: "note-1" } as never));

    await waitFor(() => {
      expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        noteId: "note-1",
      });
      expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveNote", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveNote());

    await act(() => result.current.mutateAsync({ noteId: "note-2" } as never));

    await waitFor(() => {
      expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        noteId: "note-2",
      });
      expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreNote", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreNote());

    await act(() => result.current.mutateAsync({ noteId: "note-3" } as never));

    await waitFor(() => {
      expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        noteId: "note-3",
      });
      expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteNote", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteNote());

    await act(() => result.current.mutateAsync({ noteId: "note-4" } as never));

    await waitFor(() => {
      expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        noteId: "note-4",
      });
      expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
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

const LOCAL_NOTE_ROW: Record<string, unknown> = {
  id: "note-local-1",
  system_id: TEST_SYSTEM_ID,
  author_entity_type: null,
  author_entity_id: null,
  title: "My Local Note",
  content: "From SQLite",
  background_color: null,
  archived: 0,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

describe("useNote (local source)", () => {
  it("returns transformed local row data", async () => {
    const localDb = createMockLocalDb([LOCAL_NOTE_ROW]);
    const { result } = renderHookWithProviders(() => useNote(brandId<NoteId>("note-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryOne).toHaveBeenCalledWith(expect.stringContaining("own_notes"), [
      "note-local-1",
    ]);
    expect(result.current.data).toMatchObject({
      id: "note-local-1",
      title: "My Local Note",
      content: "From SQLite",
      archived: false,
    });
  });

  it("does not call tRPC in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_NOTE_ROW]);
    const { result } = renderHookWithProviders(() => useNote(brandId<NoteId>("note-local-1")), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.title).toBe("My Local Note");
  });
});

describe("useNotesList (local source)", () => {
  it("returns flat array of transformed rows", async () => {
    const row2 = { ...LOCAL_NOTE_ROW, id: "note-local-2", title: "Second Note" };
    const localDb = createMockLocalDb([LOCAL_NOTE_ROW, row2]);
    const { result } = renderHookWithProviders(() => useNotesList(), {
      querySource: "local",
      localDb,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(localDb.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("own_notes"),
      expect.arrayContaining([TEST_SYSTEM_ID]),
    );

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "My Local Note" });
    expect(items[1]).toMatchObject({ title: "Second Note" });
  });

  it("does not require masterKey in local mode", async () => {
    const localDb = createMockLocalDb([LOCAL_NOTE_ROW]);
    const { result } = renderHookWithProviders(() => useNotesList(), {
      querySource: "local",
      localDb,
      masterKey: null,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(1);
  });
});
