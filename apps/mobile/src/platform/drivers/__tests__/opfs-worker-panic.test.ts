/**
 * OPFS worker global panic listener tests.
 *
 * Covers: messageerror, error, unhandledrejection envelope format,
 *         empty-reason coercion, message content narrowing
 * Companion file: opfs-worker-dispatch.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WorkerEventType = "message" | "error" | "messageerror" | "unhandledrejection";

interface FakeSelf {
  listenersByType: Map<WorkerEventType, Array<(ev: unknown) => void>>;
  lastPosted: unknown[];
  addEventListener: (type: WorkerEventType, listener: (ev: unknown) => void) => void;
  postMessage: (msg: unknown) => void;
}

function installFakeSelf(): FakeSelf {
  const listenersByType = new Map<WorkerEventType, Array<(ev: unknown) => void>>();
  const fake: FakeSelf = {
    listenersByType,
    lastPosted: [],
    addEventListener(type, listener) {
      const arr = listenersByType.get(type) ?? [];
      arr.push(listener);
      listenersByType.set(type, arr);
    },
    postMessage(msg) {
      this.lastPosted.push(msg);
    },
  };
  Object.assign(globalThis, { self: fake });
  return fake;
}

const mockExec = vi.fn<SQLiteAPI["exec"]>();
const mockClose = vi.fn<SQLiteAPI["close"]>();
const mockOpenV2 = vi.fn<SQLiteAPI["open_v2"]>();
const mockVfsRegister = vi.fn<SQLiteAPI["vfs_register"]>();
const mockStatements = vi.fn<SQLiteAPI["statements"]>();
const mockBindCollection = vi.fn<SQLiteAPI["bind_collection"]>();
const mockStep = vi.fn<SQLiteAPI["step"]>();
const mockRow = vi.fn<SQLiteAPI["row"]>();
const mockColumnNames = vi.fn<SQLiteAPI["column_names"]>();
const mockFinalize = vi.fn<SQLiteAPI["finalize"]>();
const mockReset = vi.fn<SQLiteAPI["reset"]>();

interface MockedSqlite3 {
  exec: SQLiteAPI["exec"];
  close: SQLiteAPI["close"];
  open_v2: SQLiteAPI["open_v2"];
  vfs_register: SQLiteAPI["vfs_register"];
  statements: SQLiteAPI["statements"];
  bind_collection: SQLiteAPI["bind_collection"];
  step: SQLiteAPI["step"];
  row: SQLiteAPI["row"];
  column_names: SQLiteAPI["column_names"];
  finalize: SQLiteAPI["finalize"];
  reset: SQLiteAPI["reset"];
}

const mockSqlite3: MockedSqlite3 = {
  exec: mockExec,
  close: mockClose,
  open_v2: mockOpenV2,
  vfs_register: mockVfsRegister,
  statements: mockStatements,
  bind_collection: mockBindCollection,
  step: mockStep,
  row: mockRow,
  column_names: mockColumnNames,
  finalize: mockFinalize,
  reset: mockReset,
};

vi.mock("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs", () => ({
  default: vi.fn().mockResolvedValue({ _brand: Symbol("mock-wa-module") }),
}));
vi.mock("@journeyapps/wa-sqlite", () => ({
  Factory: vi.fn(() => mockSqlite3),
}));
vi.mock("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js", () => ({
  OPFSCoopSyncVFS: {
    create: vi.fn().mockResolvedValue({ _opfsBrand: Symbol("mock-vfs") }),
  },
}));

let fakeSelf: FakeSelf;

const ORIGINAL_SELF_KEY = "self" as const;
let originalSelf: unknown;
let originalSelfPresent = false;

beforeEach(async () => {
  originalSelfPresent = Object.prototype.hasOwnProperty.call(globalThis, ORIGINAL_SELF_KEY);
  originalSelf = originalSelfPresent ? Reflect.get(globalThis, ORIGINAL_SELF_KEY) : undefined;

  vi.clearAllMocks();
  mockOpenV2.mockResolvedValue(1);
  mockExec.mockResolvedValue(0);
  mockClose.mockResolvedValue(0);
  mockBindCollection.mockReturnValue(0);
  mockFinalize.mockResolvedValue(0);
  mockReset.mockResolvedValue(0);
  fakeSelf = installFakeSelf();
  vi.resetModules();
  await import("../opfs-worker.js");
});

afterEach(() => {
  if (originalSelfPresent) {
    Object.assign(globalThis, { [ORIGINAL_SELF_KEY]: originalSelf });
  } else {
    Reflect.deleteProperty(globalThis, ORIGINAL_SELF_KEY);
  }
});

/**
 * Global error/messageerror/unhandledrejection listeners that post panic
 * envelopes (id=-1) so the main-thread proxy can surface silent worker death.
 */
describe("opfs-worker — global panic listeners", () => {
  it("posts a panic envelope when a 'messageerror' event fires", () => {
    const listeners = fakeSelf.listenersByType.get("messageerror") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("messageerror listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ data: "non-cloneable" });
    expect(fakeSelf.lastPosted).toHaveLength(before + 1);
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "messageerror", message: "non-cloneable" },
    });
  });

  it("posts a panic envelope with '(empty reason)' when messageerror data is empty", () => {
    const listeners = fakeSelf.listenersByType.get("messageerror") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("messageerror listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ data: "" });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "messageerror", message: "(empty reason)" },
    });
  });

  it("posts a panic envelope on global 'error' event", () => {
    const listeners = fakeSelf.listenersByType.get("error") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("error listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ message: "uncaught: boom" });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "error" },
    });
    if (posted === null || typeof posted !== "object") throw new Error("bad posted");
    const rec: Record<string, unknown> = posted as Record<string, unknown>;
    const errField = rec.error;
    if (errField === null || typeof errField !== "object") throw new Error("bad error");
    const errRec: Record<string, unknown> = errField as Record<string, unknown>;
    expect(errRec.message).toMatch(/boom/);
  });

  it("posts a panic envelope on 'unhandledrejection' with Error reason", () => {
    const listeners = fakeSelf.listenersByType.get("unhandledrejection") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("unhandledrejection listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ reason: new Error("late reject") });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "unhandledrejection" },
    });
    if (posted === null || typeof posted !== "object") throw new Error("bad posted");
    const rec: Record<string, unknown> = posted as Record<string, unknown>;
    const errField = rec.error;
    if (errField === null || typeof errField !== "object") throw new Error("bad error");
    const errRec: Record<string, unknown> = errField as Record<string, unknown>;
    expect(errRec.message).toMatch(/late reject/);
  });
});
