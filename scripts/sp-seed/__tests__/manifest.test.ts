// scripts/sp-seed/__tests__/manifest.test.ts
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, loadManifest, writeManifestAtomic } from "../manifest.js";
import { LegacyManifestError } from "../client.js";

describe("manifest read/write round-trip", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sp-seed-manifest-"));
    process.chdir(tmpDir);
    // loadManifest writes to scripts/ — create the dir.
    mkdirSync(join(tmpDir, "scripts"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("loadManifest returns undefined when file does not exist", () => {
    expect(loadManifest("minimal")).toBeUndefined();
  });

  test("writeManifestAtomic + loadManifest round-trip", () => {
    const m = {
      ...emptyManifest("test-uid", "minimal"),
      members: [
        { ref: "member.alice", sourceId: "507f1f77bcf86cd799439011", fields: { name: "Alice" } },
      ],
    };
    writeManifestAtomic("minimal", m);
    expect(loadManifest("minimal")).toEqual(m);
  });

  test("loadManifest throws LegacyManifestError when an entry lacks `ref`", () => {
    writeFileSync(
      "scripts/.sp-test-minimal-manifest.json",
      JSON.stringify({
        systemId: "uid",
        mode: "minimal",
        members: [
          // Missing `ref` field — legacy format.
          { sourceId: "507f1f77bcf86cd799439011", fields: { name: "Alice" } },
        ],
        privacyBuckets: [],
        customFields: [],
        customFronts: [],
        groups: [],
        frontHistory: [],
        comments: [],
        notes: [],
        polls: [],
        channelCategories: [],
        channels: [],
        chatMessages: [],
        boardMessages: [],
      }),
      "utf-8",
    );
    expect(() => loadManifest("minimal")).toThrow(LegacyManifestError);
  });
});
