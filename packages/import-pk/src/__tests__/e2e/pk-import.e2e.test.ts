/**
 * E2E tests for the PK import engine.
 *
 * **In-memory tests** exercise the full pipeline: file parsing, Zod validation,
 * mapper dispatch, switch-to-session diffing, privacy-bucket synthesis, and
 * in-memory persistence — all from actual PK export JSON fixtures.
 *
 * **Server-backed tests** boot a real API server via global-setup, register
 * accounts, run the import engine with a tRPC-backed persister that encrypts
 * with T1 keys, and verify entities by fetching + decrypting from the server.
 *
 * A live-API test suite is gated behind PK_TEST_LIVE_API=true.
 */
import { existsSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  fixturePath,
  getSystemId,
  makeTrpcClient,
  registerTestAccount,
  runFileImport,
  runServerFileImport,
} from "./e2e-helpers.js";
import {
  assertPkFrontingSessions,
  assertPkGroups,
  assertPkMembers,
  assertPkPrivacyBuckets,
} from "./entity-assertions.js";

import type {
  E2EPersisterCtx as E2EPersisterContext,
  FileImportResult,
  TRPCClient,
} from "./e2e-helpers.js";
import type { PkMappedGroup } from "../../mappers/group.mapper.js";
import type { PkMappedMember } from "../../mappers/member.mapper.js";
import type { PkMappedFrontingSession } from "../../mappers/switch.mapper.js";
import type { ImportRunResult } from "@pluralscape/import-core";
import type { InMemoryPersisterSnapshot } from "@pluralscape/import-core/testing";

// ── Guard helpers ───────────────────────────────────────────────────

const MINIMAL_FIXTURE_PATH = fixturePath("minimal-export.json");
const ADVERSARIAL_FIXTURE_PATH = fixturePath("adversarial-export.json");

const hasMinimalFixture = existsSync(MINIMAL_FIXTURE_PATH);
const hasAdversarialFixture = existsSync(ADVERSARIAL_FIXTURE_PATH);

function hasLiveApiEnabled(): boolean {
  return process.env["PK_TEST_LIVE_API"] === "true";
}

/**
 * Detect whether a real API server is running (booted by global-setup).
 * The server PID env var is set by the shared E2E setup factory.
 */
function hasApiServer(): boolean {
  return process.env["E2E_SERVER_PID"] !== undefined;
}

// ── Session helpers (for in-memory snapshot tests) ──────────────────

function allSessionPayloads(snap: InMemoryPersisterSnapshot): PkMappedFrontingSession[] {
  return snap.entities
    .filter((e) => e.entityType === "fronting-session")
    .map((e) => e.payload as PkMappedFrontingSession);
}

function sessionsForMember(
  snap: InMemoryPersisterSnapshot,
  memberId: string,
): PkMappedFrontingSession[] {
  return allSessionPayloads(snap).filter((s) => s.memberId === memberId);
}

function resolveMemberId(snap: InMemoryPersisterSnapshot, sourceId: string): string {
  const entity = snap.find("member", sourceId);
  if (entity === undefined) {
    throw new Error(`Expected member "${sourceId}" in snapshot but not found`);
  }
  return entity.pluralscapeEntityId;
}

// ── Expected timestamps for minimal fixture ────────────────────────

const MINIMAL_TIMESTAMPS = {
  sw1: Date.parse("2024-01-01T00:00:00Z"),
  sw2: Date.parse("2024-01-03T00:00:00Z"),
  sw3: Date.parse("2024-01-05T00:00:00Z"),
  sw4: Date.parse("2024-01-07T00:00:00Z"),
  sw5: Date.parse("2024-01-08T00:00:00Z"),
} as const;

// ══════════════════════════════════════════════════════════════════════
// IN-MEMORY TESTS — validate parsing, mapping, and in-memory persistence
// ══════════════════════════════════════════════════════════════════════

describe.skipIf(!hasMinimalFixture)("PK file source E2E -- minimal export (in-memory)", () => {
  let importResult: FileImportResult;

  beforeAll(async () => {
    importResult = await runFileImport(MINIMAL_FIXTURE_PATH);
  });

  it("import completes successfully", () => {
    expect(importResult.result.outcome).toBe("completed");
  });

  it("produces zero fatal errors", () => {
    const fatalCount = importResult.result.errors.filter((e) => e.fatal).length;
    expect(fatalCount).toBe(0);
  });

  it("creates 3 members with correct names", () => {
    const { snapshot } = importResult;
    expect(snapshot.countByType("member")).toBe(3);

    const alice = snapshot.find("member", "aaaaa");
    expect(alice).toBeDefined();
    expect((alice?.payload as PkMappedMember).encrypted.name).toBe("Alice");

    const bob = snapshot.find("member", "bbbbb");
    expect(bob).toBeDefined();
    expect((bob?.payload as PkMappedMember).encrypted.name).toBe("Bob");

    const charlie = snapshot.find("member", "ccccc");
    expect(charlie).toBeDefined();
    expect((charlie?.payload as PkMappedMember).encrypted.name).toBe("Charlie");
  });

  it("maps Alice with pronouns, color, and avatar", () => {
    const alice = importResult.snapshot.find("member", "aaaaa");
    const payload = alice?.payload as PkMappedMember;
    expect(payload.encrypted.pronouns).toEqual(["she/her"]);
    expect(payload.encrypted.colors).toEqual(["#ff6b6b"]);
    expect(payload.encrypted.avatarSource).toEqual({
      kind: "external",
      url: "https://example.com/alice.png",
    });
  });

  it("maps Bob with color and no avatar", () => {
    const bob = importResult.snapshot.find("member", "bbbbb");
    const payload = bob?.payload as PkMappedMember;
    expect(payload.encrypted.pronouns).toEqual(["he/him"]);
    expect(payload.encrypted.colors).toEqual(["#4ecdc4"]);
    expect(payload.encrypted.avatarSource).toBeNull();
  });

  it("maps Charlie with no color and no avatar", () => {
    const charlie = importResult.snapshot.find("member", "ccccc");
    const payload = charlie?.payload as PkMappedMember;
    expect(payload.encrypted.pronouns).toEqual(["they/them"]);
    expect(payload.encrypted.colors).toEqual([]);
    expect(payload.encrypted.avatarSource).toBeNull();
  });

  it("creates 2 groups with correct memberships", () => {
    const { snapshot } = importResult;
    expect(snapshot.countByType("group")).toBe(2);

    const groupA = snapshot.find("group", "grp01");
    expect(groupA).toBeDefined();
    const groupAPayload = groupA?.payload as PkMappedGroup;
    expect(groupAPayload.memberIds).toHaveLength(2);

    const groupB = snapshot.find("group", "grp02");
    expect(groupB).toBeDefined();
    const groupBPayload = groupB?.payload as PkMappedGroup;
    expect(groupBPayload.memberIds).toHaveLength(1);
  });

  it("Alice has one completed session [sw1, sw3)", () => {
    const { snapshot } = importResult;
    const aliceId = resolveMemberId(snapshot, "aaaaa");
    const sessions = sessionsForMember(snapshot, aliceId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(MINIMAL_TIMESTAMPS.sw1);
    expect(sessions[0]?.endTime).toBe(MINIMAL_TIMESTAMPS.sw3);
  });

  it("Bob has one completed session [sw2, sw4)", () => {
    const { snapshot } = importResult;
    const bobId = resolveMemberId(snapshot, "bbbbb");
    const sessions = sessionsForMember(snapshot, bobId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(MINIMAL_TIMESTAMPS.sw2);
    expect(sessions[0]?.endTime).toBe(MINIMAL_TIMESTAMPS.sw4);
  });

  it("Charlie has one active session [sw5, null)", () => {
    const { snapshot } = importResult;
    const charlieId = resolveMemberId(snapshot, "ccccc");
    const sessions = sessionsForMember(snapshot, charlieId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(MINIMAL_TIMESTAMPS.sw5);
    expect(sessions[0]?.endTime).toBeNull();
  });

  it("creates PK Private privacy bucket for Alice", () => {
    const { snapshot } = importResult;
    expect(snapshot.countByType("privacy-bucket")).toBe(1);
    const bucket = snapshot.find("privacy-bucket", "synthetic:pk-private");
    expect(bucket).toBeDefined();
  });

  it("total fronting session count is 3", () => {
    expect(importResult.snapshot.countByType("fronting-session")).toBe(3);
  });
});

describe.skipIf(!hasAdversarialFixture)(
  "PK file source E2E -- adversarial export (in-memory)",
  () => {
    let importResult: FileImportResult;

    beforeAll(async () => {
      importResult = await runFileImport(ADVERSARIAL_FIXTURE_PATH);
    });

    it("import completes successfully", () => {
      expect(importResult.result.outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      const fatalCount = importResult.result.errors.filter((e) => e.fatal).length;
      expect(fatalCount).toBe(0);
    });

    it("members with Unicode names imported correctly", () => {
      const { snapshot } = importResult;

      const elise = snapshot.find("member", "unis1");
      expect(elise).toBeDefined();
      expect((elise?.payload as PkMappedMember).encrypted.name).toBe("Élise");

      const cjk = snapshot.find("member", "unis2");
      expect(cjk).toBeDefined();
      expect((cjk?.payload as PkMappedMember).encrypted.name).toBe("光の子");

      const sigma = snapshot.find("member", "unis3");
      expect(sigma).toBeDefined();
      expect((sigma?.payload as PkMappedMember).encrypted.name).toBe("Σιγμα");

      const wave = snapshot.find("member", "unis4");
      expect(wave).toBeDefined();
      expect((wave?.payload as PkMappedMember).encrypted.name).toBe("🌊 Wave");
    });

    it("all 5 members created (no empty names to skip)", () => {
      expect(importResult.snapshot.countByType("member")).toBe(5);
    });

    it("creates all 3 groups", () => {
      expect(importResult.snapshot.countByType("group")).toBe(3);
    });

    it("Ghost Ref Group produces warning for non-existent member", () => {
      const ghostWarnings = importResult.result.warnings.filter(
        (w) => w.entityType === "group" && w.message.includes("nonexistent_id"),
      );
      expect(ghostWarnings.length).toBeGreaterThanOrEqual(1);
    });

    it("Ghost Ref Group created with partial membership", () => {
      const ghostGroup = importResult.snapshot.find("group", "agrp2");
      expect(ghostGroup).toBeDefined();
      const payload = ghostGroup?.payload as PkMappedGroup;
      // Only unis3 should resolve; nonexistent_id is dropped
      expect(payload.memberIds).toHaveLength(1);
    });

    it("Empty Group has 0 member IDs", () => {
      const emptyGroup = importResult.snapshot.find("group", "agrp3");
      expect(emptyGroup).toBeDefined();
      const payload = emptyGroup?.payload as PkMappedGroup;
      expect(payload.memberIds).toHaveLength(0);
    });

    it("rapid-fire switches produce correct short sessions", () => {
      const { snapshot } = importResult;
      const eliseId = resolveMemberId(snapshot, "unis1");
      const eliseSessions = sessionsForMember(snapshot, eliseId);

      // With timestamps at 0ms, 100ms, 200ms, 200ms, 1000ms there should be
      // at least one session shorter than 1 second.
      const hasShortSession = eliseSessions.some((s) => {
        if (s.endTime === null) return false;
        return s.endTime - s.startTime < 1000;
      });
      expect(hasShortSession).toBe(true);
    });

    it("privacy bucket created for member with private fields", () => {
      const { snapshot } = importResult;
      // unis5 (Normal Member) has visibility: private and description_privacy: private
      expect(snapshot.countByType("privacy-bucket")).toBe(1);
      const bucket = snapshot.find("privacy-bucket", "synthetic:pk-private");
      expect(bucket).toBeDefined();
    });
  },
);

// ══════════════════════════════════════════════════════════════════════
// SERVER-BACKED TESTS — real API server, tRPC persistence, T1 encryption
// ══════════════════════════════════════════════════════════════════════

describe.skipIf(!hasMinimalFixture || !hasApiServer())(
  "PK file source E2E -- minimal export (server)",
  () => {
    let result: ImportRunResult;
    let ctx: E2EPersisterContext;
    let trpc: TRPCClient;

    beforeAll(async () => {
      const account = await registerTestAccount();
      trpc = makeTrpcClient(account.sessionToken);
      const systemId = await getSystemId(account.sessionToken);

      const importResult = await runServerFileImport(MINIMAL_FIXTURE_PATH, trpc, systemId);
      result = importResult.result;
      ctx = importResult.ctx;
    });

    it("completes without aborting", () => {
      expect(result.outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(result.errors.filter((e) => e.fatal)).toHaveLength(0);
    });

    it("created entities on the server", () => {
      expect(ctx.getCreatedCount()).toBeGreaterThan(0);
    });

    it("members have correct names on server", async () => {
      await assertPkMembers(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "aaaaa", name: "Alice" },
        { sourceId: "bbbbb", name: "Bob" },
        { sourceId: "ccccc", name: "Charlie" },
      ]);
    });

    it("groups have correct names on server", async () => {
      await assertPkGroups(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "grp01", name: "Group A" },
        { sourceId: "grp02", name: "Group B" },
      ]);
    });

    it("privacy bucket exists on server", async () => {
      await assertPkPrivacyBuckets(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "synthetic:pk-private", name: "PK Private" },
      ]);
    });

    it("fronting sessions exist on server", async () => {
      await assertPkFrontingSessions(trpc, ctx.masterKey, ctx.systemId, 3, [
        "session:aaaaa:1704067200000",
        "session:bbbbb:1704240000000",
        "session:ccccc:1704672000000",
      ]);
    });

    it("total created entity count matches expected", () => {
      // The minimal fixture creates: 3 members + 2 groups + 3 sessions + 1 bucket = 9
      expect(ctx.getCreatedCount()).toBe(9);
    });
  },
);

describe.skipIf(!hasAdversarialFixture || !hasApiServer())(
  "PK file source E2E -- adversarial export (server)",
  () => {
    let result: ImportRunResult;
    let ctx: E2EPersisterContext;
    let trpc: TRPCClient;

    beforeAll(async () => {
      const account = await registerTestAccount();
      trpc = makeTrpcClient(account.sessionToken);
      const systemId = await getSystemId(account.sessionToken);

      const importResult = await runServerFileImport(ADVERSARIAL_FIXTURE_PATH, trpc, systemId);
      result = importResult.result;
      ctx = importResult.ctx;
    });

    it("completes without aborting", () => {
      expect(result.outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      expect(result.errors.filter((e) => e.fatal)).toHaveLength(0);
    });

    it("created entities on the server", () => {
      expect(ctx.getCreatedCount()).toBeGreaterThan(0);
    });

    it("members with Unicode names stored correctly on server", async () => {
      await assertPkMembers(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "unis1", name: "Élise" },
        { sourceId: "unis2", name: "光の子" },
        { sourceId: "unis3", name: "Σιγμα" },
        { sourceId: "unis4", name: "🌊 Wave" },
        { sourceId: "unis5", name: "Normal Member" },
      ]);
    });

    it("groups stored correctly on server", async () => {
      await assertPkGroups(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "agrp1", name: "Unicode Group 🌈" },
        { sourceId: "agrp2", name: "Ghost Ref Group" },
        { sourceId: "agrp3", name: "Empty Group" },
      ]);
    });

    it("privacy bucket exists on server", async () => {
      await assertPkPrivacyBuckets(trpc, ctx.masterKey, ctx.systemId, [
        { sourceId: "synthetic:pk-private", name: "PK Private" },
      ]);
    });

    it("fronting sessions exist on server", async () => {
      await assertPkFrontingSessions(trpc, ctx.masterKey, ctx.systemId, 10, [
        "session:unis1:1719792000000",
        "session:unis2:1719792000100",
        "session:unis1:1719792000200",
        "session:unis3:1719792000200",
        "session:unis1:1719792001000",
        "session:unis4:1719792001000",
        "session:unis4:1719792120000",
        "session:unis1:1719792180000",
        "session:unis4:1719792240000",
        "session:unis3:1719795600000",
      ]);
    });
  },
);

// ── Live API Source ────────────────────────────────────────────────────

describe.skipIf(!hasLiveApiEnabled())("PK API source E2E", () => {
  it.todo("imports from seeded PK system via live API");
});
