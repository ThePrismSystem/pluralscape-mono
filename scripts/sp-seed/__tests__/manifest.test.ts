// scripts/sp-seed/__tests__/manifest.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, loadManifest, planSeed, writeManifestAtomic } from "../manifest.js";
import { LegacyManifestError, SpApiError } from "../client.js";

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
        channels: [],
        channelCategories: [],
        chatMessages: [],
        boardMessages: [],
      }),
      "utf-8",
    );
    expect(() => loadManifest("minimal")).toThrow(LegacyManifestError);
  });
});

describe("planSeed", () => {
  function makeStubClient(probeResponses: Record<string, { status: number } | Error>): {
    client: {
      request: (path: string, opts?: { method?: string }) => Promise<unknown>;
      requestRaw: () => Promise<unknown>;
    };
    calls: string[];
  } {
    const calls: string[] = [];
    const requestFn = vi.fn(async (path: string) => {
      calls.push(path);
      const r = probeResponses[path];
      if (r instanceof Error) throw r;
      if (!r) throw new SpApiError(404, "GET", path, "not found");
      if (r.status === 200) return { exists: true };
      throw new SpApiError(r.status, "GET", path, "err");
    });
    const client = {
      request: requestFn as (path: string, opts?: { method?: string }) => Promise<unknown>,
      requestRaw: vi.fn() as () => Promise<unknown>,
    };
    return { client, calls };
  }

  const emptyFixtures = {
    privacyBuckets: [],
    customFields: [],
    customFronts: [],
    members: [],
    groups: [],
    frontHistory: [],
    comments: [],
    notes: [],
    polls: [],
    channels: [],
    channelCategories: [],
    chatMessages: [],
    boardMessages: [],
    profilePatch: { desc: "", color: "" },
  };

  test("with no existing manifest, everything is in `create`", async () => {
    const fixtures = {
      ...emptyFixtures,
      members: [{ ref: "member.alice", body: { name: "Alice" } }],
    };
    const { client } = makeStubClient({});
    const plan = await planSeed(client, "sys1", fixtures, undefined);
    expect(plan.reuse).toHaveLength(0);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]!.ref).toBe("member.alice");
  });

  test("with existing manifest + 200 probe, entry goes to `reuse`", async () => {
    const fixtures = {
      ...emptyFixtures,
      members: [{ ref: "member.alice", body: { name: "Alice" } }],
    };
    const existing = {
      systemId: "sys1",
      mode: "minimal" as const,
      ...emptyFixtures,
      members: [
        { ref: "member.alice", sourceId: "507f1f77bcf86cd799439011", fields: { name: "Alice" } },
      ],
    };
    const { client } = makeStubClient({
      "/v1/member/sys1/507f1f77bcf86cd799439011": { status: 200 },
    });
    const plan = await planSeed(client, "sys1", fixtures, existing);
    expect(plan.reuse).toHaveLength(1);
    expect(plan.reuse[0]).toEqual({
      entityType: "members",
      ref: "member.alice",
      sourceId: "507f1f77bcf86cd799439011",
      fields: { name: "Alice" },
    });
    expect(plan.create).toHaveLength(0);
  });

  test("404 on probe → entry goes to `create`", async () => {
    const fixtures = {
      ...emptyFixtures,
      members: [{ ref: "member.alice", body: { name: "Alice" } }],
    };
    const existing = {
      systemId: "sys1",
      mode: "minimal" as const,
      ...emptyFixtures,
      members: [
        { ref: "member.alice", sourceId: "507f1f77bcf86cd799439011", fields: { name: "Alice" } },
      ],
    };
    const { client } = makeStubClient({
      "/v1/member/sys1/507f1f77bcf86cd799439011": new SpApiError(404, "GET", "", "not found"),
    });
    const plan = await planSeed(client, "sys1", fixtures, existing);
    expect(plan.reuse).toHaveLength(0);
    expect(plan.create).toHaveLength(1);
  });

  test("401 on probe → escalates with SpApiError", async () => {
    const fixtures = {
      ...emptyFixtures,
      members: [{ ref: "member.alice", body: { name: "Alice" } }],
    };
    const existing = {
      systemId: "sys1",
      mode: "minimal" as const,
      ...emptyFixtures,
      members: [
        { ref: "member.alice", sourceId: "507f1f77bcf86cd799439011", fields: { name: "Alice" } },
      ],
    };
    const { client } = makeStubClient({
      "/v1/member/sys1/507f1f77bcf86cd799439011": new SpApiError(401, "GET", "", "unauthorized"),
    });
    await expect(planSeed(client, "sys1", fixtures, existing)).rejects.toMatchObject({
      name: "SpApiError",
      status: 401,
    });
  });
});
