import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyContexts,
  type ContextApiClient,
  diffContexts,
  loadAllContexts,
} from "../../crowdin/context.js";

interface StringFixture {
  id: number;
  fileId: number;
  identifier: string;
  context: string | null;
}

const COMMON_FILE_ID = 30;

describe("diffContexts", () => {
  function desiredFor(
    fileId: number,
    entries: Record<string, string>,
  ): Map<number, Map<string, string>> {
    return new Map([[fileId, new Map(Object.entries(entries))]]);
  }

  it("returns zero updates when all strings match desired context", () => {
    const strings: StringFixture[] = [
      { id: 1, fileId: COMMON_FILE_ID, identifier: "ok", context: "Affirmation button." },
    ];
    const desired = desiredFor(COMMON_FILE_ID, { ok: "Affirmation button." });
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("returns one update when a context differs", () => {
    const strings: StringFixture[] = [
      { id: 42, fileId: COMMON_FILE_ID, identifier: "ok", context: "old text" },
    ];
    const desired = desiredFor(COMMON_FILE_ID, { ok: "new text" });
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([{ id: 42, newContext: "new text" }]);
    expect(diff.unchanged).toBe(0);
  });

  it("ignores strings with no sidecar entry (never blanks manual context)", () => {
    const strings: StringFixture[] = [
      {
        id: 1,
        fileId: COMMON_FILE_ID,
        identifier: "unmapped",
        context: "manual human-authored context",
      },
    ];
    const desired = new Map<number, Map<string, string>>();
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });

  it("treats null remote context as empty string for comparison", () => {
    const strings: StringFixture[] = [
      { id: 1, fileId: COMMON_FILE_ID, identifier: "ok", context: null },
    ];
    const desired = desiredFor(COMMON_FILE_ID, { ok: "Affirmation button." });
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([{ id: 1, newContext: "Affirmation button." }]);
  });

  it("does not cross-match keys across different fileIds", () => {
    const strings: StringFixture[] = [{ id: 1, fileId: 99, identifier: "ok", context: "original" }];
    const desired = desiredFor(COMMON_FILE_ID, { ok: "new context" });
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });
});

describe("loadAllContexts", () => {
  let tmpRoot: string;

  beforeEach(() => {
    // mkdtempSync atomically creates a unique directory (uses O_EXCL), avoiding
    // the CodeQL insecure-temporary-file pattern a Date.now()+Math.random() path
    // trips on (same-tick collisions let another process pre-create the path).
    tmpRoot = mkdtempSync(path.join(tmpdir(), "crowdin-context-test-"));
    mkdirSync(path.join(tmpRoot, "apps/mobile/locales/en"), { recursive: true });
    writeFileSync(
      path.join(tmpRoot, "apps/mobile/locales/en", "common.context.json"),
      JSON.stringify({ ok: "Affirmation." }),
    );
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("loads entries as nested namespace → key maps", () => {
    const result = loadAllContexts(tmpRoot);
    expect(result.get("common")?.get("ok")).toBe("Affirmation.");
    expect(result.get("common")?.size).toBe(1);
  });
});

describe("applyContexts", () => {
  type ListStringsFn = ContextApiClient["sourceStringsApi"]["listProjectStrings"];
  type EditFn = ContextApiClient["sourceStringsApi"]["editString"];
  type ListFilesFn = ContextApiClient["sourceFilesApi"]["listProjectFiles"];

  function filesResponse(files: Array<{ id: number; name: string }>): {
    data: Array<{ data: { id: number; name: string } }>;
  } {
    return { data: files.map((f) => ({ data: f })) };
  }

  function makeFilesMock(files: Array<{ id: number; name: string }>): ListFilesFn {
    return vi.fn<ListFilesFn>().mockResolvedValueOnce(filesResponse(files));
  }

  it("paginates strings across multiple full pages and stops on a short page", async () => {
    const LIST_PAGE_SIZE = 500;
    const firstPage = Array.from({ length: LIST_PAGE_SIZE }, (_, i) => ({
      data: { id: i + 1, fileId: COMMON_FILE_ID, identifier: `key${String(i + 1)}`, context: null },
    }));
    const secondPage = [
      {
        data: {
          id: LIST_PAGE_SIZE + 1,
          fileId: COMMON_FILE_ID,
          identifier: "keyLast",
          context: null,
        },
      },
    ];
    const listProjectStrings = vi
      .fn<ListStringsFn>()
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles: makeFilesMock([]) },
      sourceStringsApi: { listProjectStrings, editString },
    };
    const result = await applyContexts(client, 100, new Map());
    expect(listProjectStrings).toHaveBeenCalledTimes(2);
    expect(result.remoteIdentifiersChecked).toBe(LIST_PAGE_SIZE + 1);
  });

  it("fetches exactly one page and stops when that page is already short", async () => {
    const listProjectStrings = vi.fn<ListStringsFn>().mockResolvedValueOnce({
      data: [{ data: { id: 1, fileId: COMMON_FILE_ID, identifier: "only", context: null } }],
    });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles: makeFilesMock([]) },
      sourceStringsApi: { listProjectStrings, editString },
    };
    const result = await applyContexts(client, 100, new Map());
    expect(listProjectStrings).toHaveBeenCalledTimes(1);
    expect(result.remoteIdentifiersChecked).toBe(1);
  });

  it("throws when MAX_PAGES is exceeded on strings (guard against infinite pagination)", async () => {
    const LIST_PAGE_SIZE = 500;
    const fullPage = Array.from({ length: LIST_PAGE_SIZE }, (_, i) => ({
      data: { id: i + 1, fileId: COMMON_FILE_ID, identifier: `key${String(i + 1)}`, context: null },
    }));
    const listProjectStrings = vi.fn<ListStringsFn>().mockResolvedValue({ data: fullPage });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles: makeFilesMock([]) },
      sourceStringsApi: { listProjectStrings, editString },
    };
    await expect(applyContexts(client, 100, new Map())).rejects.toThrow(/MAX_PAGES/);
  });

  it("aggregates per-item failures into AggregateError and continues past them", async () => {
    const listProjectFiles = makeFilesMock([{ id: COMMON_FILE_ID, name: "common.json" }]);
    const listProjectStrings = vi.fn<ListStringsFn>().mockResolvedValueOnce({
      data: [
        { data: { id: 1, fileId: COMMON_FILE_ID, identifier: "ok", context: "old" } },
        { data: { id: 2, fileId: COMMON_FILE_ID, identifier: "cancel", context: "old" } },
        { data: { id: 3, fileId: COMMON_FILE_ID, identifier: "save", context: "old" } },
      ],
    });
    const editString = vi
      .fn<EditFn>()
      .mockRejectedValueOnce(new Error("500 first"))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("500 third"));
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles },
      sourceStringsApi: { listProjectStrings, editString },
    };

    const desired = new Map([
      [
        "common",
        new Map([
          ["ok", "new"],
          ["cancel", "new"],
          ["save", "new"],
        ]),
      ],
    ]);

    await expect(applyContexts(client, 100, desired)).rejects.toThrow(AggregateError);
    expect(editString).toHaveBeenCalledTimes(3);
  });

  it("reports unmatched keys as <namespace>.<key> when Crowdin returns no matching identifier", async () => {
    const listProjectFiles = makeFilesMock([{ id: COMMON_FILE_ID, name: "common.json" }]);
    // Crowdin returns a different key under the same file.
    const listProjectStrings = vi.fn<ListStringsFn>().mockResolvedValueOnce({
      data: [{ data: { id: 1, fileId: COMMON_FILE_ID, identifier: "other", context: null } }],
    });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles },
      sourceStringsApi: { listProjectStrings, editString },
    };
    const desired = new Map([["common", new Map([["ok", "some context"]])]]);

    const result = await applyContexts(client, 100, desired);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.unmatchedDesiredKeys).toEqual(["common.ok"]);
    expect(result.unmatchedNamespaces).toEqual([]);
    expect(editString).not.toHaveBeenCalled();
  });

  it("reports unmatchedNamespaces when a sidecar namespace has no matching Crowdin file", async () => {
    const listProjectFiles = makeFilesMock([{ id: COMMON_FILE_ID, name: "common.json" }]);
    const listProjectStrings = vi.fn<ListStringsFn>().mockResolvedValueOnce({ data: [] });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceFilesApi: { listProjectFiles },
      sourceStringsApi: { listProjectStrings, editString },
    };
    const desired = new Map([
      ["common", new Map([["ok", "some context"]])],
      ["auth", new Map([["login", "login button"]])],
    ]);

    const result = await applyContexts(client, 100, desired);
    expect(result.unmatchedNamespaces).toEqual(["auth"]);
    // Keys in the matched namespace are unmatched-by-key (not by namespace).
    expect(result.unmatchedDesiredKeys).toEqual(["common.ok"]);
  });
});
