// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptNoteInput } from "@pluralscape/data/transforms/note";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { NoteRaw } from "@pluralscape/data/transforms/note";
import type { NoteId, UnixMillis } from "@pluralscape/types";

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
let lastCreateMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};
let lastArchiveMutationOpts: CapturedOpts = {};
let lastRestoreMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};

const mockUtils = {
  note: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    note: {
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
  useNote,
  useNotesList,
  useCreateNote,
  useUpdateNote,
  useArchiveNote,
  useRestoreNote,
  useDeleteNote,
} = await import("../use-notes.js");

// ── Fixtures ───────────────────────────────────────────────────��─────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawNote(id: string): NoteRaw {
  const encrypted = encryptNoteInput(
    { title: "Note", content: "Body", backgroundColor: null },
    TEST_MASTER_KEY,
  );
  return {
    id: id as NoteId,
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

// ── Tests ────────────────────────────────────────────────────────��───
describe("useNote", () => {
  it("enables when masterKey is present", () => {
    useNote("note-1" as NoteId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useNote("note-1" as NoteId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw note correctly", () => {
    useNote("note-1" as NoteId);
    const select = lastQueryOpts["select"] as (raw: NoteRaw) => unknown;
    const raw = makeRawNote("note-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["title"]).toBe("Note");
    expect(result["content"]).toBe("Body");
    expect(result["backgroundColor"]).toBeNull();
    expect(result["authorEntityType"]).toBeNull();
    expect(result["archived"]).toBe(false);
  });
});

describe("useNotesList", () => {
  it("select decrypts each page item", () => {
    useNotesList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawNote("note-1");
    const raw2 = makeRawNote("note-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["title"]).toBe("Note");
    expect(result.pages[0].data[1]["title"]).toBe("Note");
  });
});

describe("useCreateNote", () => {
  it("invalidates list on success", () => {
    mockUtils.note.list.invalidate.mockClear();
    useCreateNote();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateNote", () => {
  it("invalidates get and list on success", () => {
    mockUtils.note.get.invalidate.mockClear();
    mockUtils.note.list.invalidate.mockClear();
    useUpdateNote();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { noteId: string },
    ) => void;
    onSuccess(undefined, { noteId: "note-1" });
    expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      noteId: "note-1",
    });
    expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useArchiveNote", () => {
  it("invalidates get and list on success", () => {
    mockUtils.note.get.invalidate.mockClear();
    mockUtils.note.list.invalidate.mockClear();
    useArchiveNote();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { noteId: string },
    ) => void;
    onSuccess(undefined, { noteId: "note-2" });
    expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      noteId: "note-2",
    });
    expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestoreNote", () => {
  it("invalidates get and list on success", () => {
    mockUtils.note.get.invalidate.mockClear();
    mockUtils.note.list.invalidate.mockClear();
    useRestoreNote();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { noteId: string },
    ) => void;
    onSuccess(undefined, { noteId: "note-3" });
    expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      noteId: "note-3",
    });
    expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteNote", () => {
  it("invalidates get and list on success", () => {
    mockUtils.note.get.invalidate.mockClear();
    mockUtils.note.list.invalidate.mockClear();
    useDeleteNote();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { noteId: string },
    ) => void;
    onSuccess(undefined, { noteId: "note-4" });
    expect(mockUtils.note.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      noteId: "note-4",
    });
    expect(mockUtils.note.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});
