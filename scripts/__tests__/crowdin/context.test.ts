import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  identifier: string;
  context: string | null;
}

describe("diffContexts", () => {
  it("returns zero updates when all strings match desired context", () => {
    const strings: StringFixture[] = [
      { id: 1, identifier: "common.ok", context: "Affirmation button." },
    ];
    const desired = new Map([["common.ok", "Affirmation button."]]);
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("returns one update when a context differs", () => {
    const strings: StringFixture[] = [{ id: 42, identifier: "common.ok", context: "old text" }];
    const desired = new Map([["common.ok", "new text"]]);
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([{ id: 42, newContext: "new text" }]);
    expect(diff.unchanged).toBe(0);
  });

  it("ignores strings with no sidecar entry (never blanks manual context)", () => {
    const strings: StringFixture[] = [
      { id: 1, identifier: "common.unmapped", context: "manual human-authored context" },
    ];
    const desired = new Map<string, string>();
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });

  it("treats null remote context as empty string for comparison", () => {
    const strings: StringFixture[] = [{ id: 1, identifier: "common.ok", context: null }];
    const desired = new Map([["common.ok", "Affirmation button."]]);
    const diff = diffContexts(strings, desired);
    expect(diff.toUpdate).toEqual([{ id: 1, newContext: "Affirmation button." }]);
  });
});

describe("loadAllContexts", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = path.join(tmpdir(), `crowdin-context-test-${Date.now()}-${Math.random()}`);
    mkdirSync(path.join(tmpRoot, "apps/mobile/locales/en"), { recursive: true });
    writeFileSync(
      path.join(tmpRoot, "apps/mobile/locales/en", "common.context.json"),
      JSON.stringify({ ok: "Affirmation." }),
    );
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("loads entries from all sidecar files, namespaced", () => {
    const result = loadAllContexts(tmpRoot);
    expect(result.get("common.ok")).toBe("Affirmation.");
    expect(result.size).toBe(1);
  });
});

describe("applyContexts", () => {
  type ListFn = ContextApiClient["sourceStringsApi"]["listProjectStrings"];
  type EditFn = ContextApiClient["sourceStringsApi"]["editString"];

  it("paginates across multiple full pages and stops on a short page", async () => {
    const LIST_PAGE_SIZE = 500;
    const firstPage = Array.from({ length: LIST_PAGE_SIZE }, (_, i) => ({
      data: { id: i + 1, identifier: `ns.key${String(i + 1)}`, context: null },
    }));
    const secondPage = [
      { data: { id: LIST_PAGE_SIZE + 1, identifier: "ns.keyLast", context: null } },
    ];
    const listProjectStrings = vi
      .fn<ListFn>()
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceStringsApi: { listProjectStrings, editString },
    };
    const result = await applyContexts(client, 100, new Map());
    expect(listProjectStrings).toHaveBeenCalledTimes(2);
    expect(result.remoteIdentifiersChecked).toBe(LIST_PAGE_SIZE + 1);
  });

  it("fetches exactly one page and stops when that page is already short", async () => {
    const listProjectStrings = vi.fn<ListFn>().mockResolvedValueOnce({
      data: [{ data: { id: 1, identifier: "ns.only", context: null } }],
    });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceStringsApi: { listProjectStrings, editString },
    };
    const result = await applyContexts(client, 100, new Map());
    expect(listProjectStrings).toHaveBeenCalledTimes(1);
    expect(result.remoteIdentifiersChecked).toBe(1);
  });

  it("throws when MAX_PAGES is exceeded (guard against infinite pagination)", async () => {
    const LIST_PAGE_SIZE = 500;
    // Every response is a full page, forcing the loop to hit MAX_PAGES.
    const fullPage = Array.from({ length: LIST_PAGE_SIZE }, (_, i) => ({
      data: { id: i + 1, identifier: `ns.key${String(i + 1)}`, context: null },
    }));
    const listProjectStrings = vi.fn<ListFn>().mockResolvedValue({ data: fullPage });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceStringsApi: { listProjectStrings, editString },
    };
    await expect(applyContexts(client, 100, new Map())).rejects.toThrow(/MAX_PAGES/);
  });

  it("aggregates per-item failures into AggregateError and continues past them", async () => {
    const listProjectStrings = vi.fn<ListFn>().mockResolvedValueOnce({
      data: [
        { data: { id: 1, identifier: "common.ok", context: "old" } },
        { data: { id: 2, identifier: "common.cancel", context: "old" } },
        { data: { id: 3, identifier: "common.save", context: "old" } },
      ],
    });
    const editString = vi
      .fn<EditFn>()
      .mockRejectedValueOnce(new Error("500 first"))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("500 third"));
    const client: ContextApiClient = {
      sourceStringsApi: { listProjectStrings, editString },
    };

    const desired = new Map([
      ["common.ok", "new"],
      ["common.cancel", "new"],
      ["common.save", "new"],
    ]);

    await expect(applyContexts(client, 100, desired)).rejects.toThrow(AggregateError);
    expect(editString).toHaveBeenCalledTimes(3);
  });

  it("reports unmatchedDesiredKeys when sidecar keys don't match any remote identifier", async () => {
    const listProjectStrings = vi.fn<ListFn>().mockResolvedValueOnce({
      data: [{ data: { id: 1, identifier: "ok", context: null } }],
    });
    const editString = vi.fn<EditFn>();
    const client: ContextApiClient = {
      sourceStringsApi: { listProjectStrings, editString },
    };
    const desired = new Map([["common.ok", "some context"]]);

    const result = await applyContexts(client, 100, desired);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.unmatchedDesiredKeys).toEqual(["common.ok"]);
    expect(result.remoteIdentifiersChecked).toBe(1);
    expect(editString).not.toHaveBeenCalled();
  });
});
