import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffContexts, loadAllContexts } from "../../crowdin/context.js";

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
    for (const ns of ["common", "auth", "fronting", "members", "settings"]) {
      const body = ns === "common" ? { ok: "Affirmation." } : {};
      writeFileSync(
        path.join(tmpRoot, "apps/mobile/locales/en", `${ns}.context.json`),
        JSON.stringify(body),
      );
    }
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
