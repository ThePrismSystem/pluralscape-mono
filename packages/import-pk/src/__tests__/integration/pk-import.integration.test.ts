import { createFakeImportSource, createInMemoryPersister } from "@pluralscape/import-core/testing";
import { beforeAll, describe, expect, it } from "vitest";

import { runPkImport } from "../../run-pk-import.js";
import { adversarial, minimal } from "../fixtures/index.js";

import { buildFakeSourceData } from "./helpers.js";

import type { PkMappedGroup } from "../../mappers/group.mapper.js";
import type { PkMappedMember } from "../../mappers/member.mapper.js";
import type { PkMappedFrontingSession } from "../../mappers/switch.mapper.js";
import type { ImportRunResult, MappingWarning } from "@pluralscape/import-core";
import type { InMemoryPersisterSnapshot } from "@pluralscape/import-core/testing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noopProgress(): Promise<void> {
  return Promise.resolve();
}

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

/**
 * Resolve a member's pluralscapeEntityId from the snapshot, throwing if
 * not found so downstream assertions get a clean failure message.
 */
function resolveMemberId(snap: InMemoryPersisterSnapshot, sourceId: string): string {
  const entity = snap.find("member", sourceId);
  if (entity === undefined) {
    throw new Error(`Expected member "${sourceId}" in snapshot but not found`);
  }
  return entity.pluralscapeEntityId;
}

// ---------------------------------------------------------------------------
// 1. Minimal fixture integration tests
// ---------------------------------------------------------------------------

describe("PK Import — minimal fixture", () => {
  let result: ImportRunResult;
  let snap: InMemoryPersisterSnapshot;
  let warnings: readonly MappingWarning[];

  beforeAll(async () => {
    const fakeData = buildFakeSourceData({
      members: minimal.MEMBERS,
      groups: minimal.GROUPS,
      switches: minimal.SWITCHES,
      privacyScanMembers: minimal.PRIVACY_SCAN_MEMBERS,
    });

    const { persister, snapshot } = createInMemoryPersister();

    result = await runPkImport({
      source: createFakeImportSource(fakeData),
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    snap = snapshot();
    warnings = result.warnings;
  });

  it("completes without aborting", () => {
    expect(result.outcome).toBe("completed");
  });

  it("produces zero fatal errors", () => {
    const fatalCount = result.errors.filter((e) => e.fatal).length;
    expect(fatalCount).toBe(0);
  });

  it("creates correct member count", () => {
    expect(snap.countByType("member")).toBe(3);
  });

  it("maps Alice with correct fields", () => {
    const alice = snap.find("member", "alice1");
    expect(alice?.sourceEntityId).toBe("alice1");
    const payload = alice?.payload as PkMappedMember;
    expect(payload.encrypted.name).toBe("Alice");
    expect(payload.encrypted.pronouns).toEqual(["she/her"]);
    expect(payload.encrypted.colors).toEqual(["#ff6b6b"]);
    expect(payload.encrypted.avatarSource).toEqual({
      kind: "external",
      url: "https://example.com/alice.png",
    });
  });

  it("maps Bob with correct fields", () => {
    const bob = snap.find("member", "bob02");
    expect(bob?.sourceEntityId).toBe("bob02");
    const payload = bob?.payload as PkMappedMember;
    expect(payload.encrypted.name).toBe("Bob");
    expect(payload.encrypted.pronouns).toEqual(["he/him"]);
    expect(payload.encrypted.colors).toEqual(["#4ecdc4"]);
  });

  it("maps Charlie with correct fields", () => {
    const charlie = snap.find("member", "charl");
    expect(charlie?.sourceEntityId).toBe("charl");
    const payload = charlie?.payload as PkMappedMember;
    expect(payload.encrypted.name).toBe("Charlie");
    expect(payload.encrypted.pronouns).toEqual(["they/them"]);
    expect(payload.encrypted.colors).toEqual([]);
  });

  it("maps Bob with no avatar", () => {
    const bob = snap.find("member", "bob02");
    const payload = bob?.payload as PkMappedMember;
    expect(payload.encrypted.avatarSource).toBeNull();
  });

  it("maps Charlie with no avatar", () => {
    const charlie = snap.find("member", "charl");
    const payload = charlie?.payload as PkMappedMember;
    expect(payload.encrypted.avatarSource).toBeNull();
  });

  it("creates correct group count", () => {
    expect(snap.countByType("group")).toBe(2);
  });

  it("Group A has 2 resolved member IDs", () => {
    const groupA = snap.find("group", "grp_a");
    expect(groupA?.sourceEntityId).toBe("grp_a");
    const payload = groupA?.payload as PkMappedGroup;
    expect(payload.memberIds).toHaveLength(2);
  });

  it("Group B has 1 resolved member ID", () => {
    const groupB = snap.find("group", "grp_b");
    expect(groupB?.sourceEntityId).toBe("grp_b");
    const payload = groupB?.payload as PkMappedGroup;
    expect(payload.memberIds).toHaveLength(1);
  });

  it("creates correct fronting session count", () => {
    // Alice: 1 session, Bob: 1 session, Charlie: 1 session = 3 total
    expect(snap.countByType("fronting-session")).toBe(3);
  });

  it("Alice has one completed session [T1, T3)", () => {
    const aliceId = resolveMemberId(snap, "alice1");
    const sessions = sessionsForMember(snap, aliceId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(minimal.EXPECTED_SESSIONS.alice.startTime);
    expect(sessions[0]?.endTime).toBe(minimal.EXPECTED_SESSIONS.alice.endTime);
  });

  it("Bob has one completed session [T2, T4)", () => {
    const bobId = resolveMemberId(snap, "bob02");
    const sessions = sessionsForMember(snap, bobId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(minimal.EXPECTED_SESSIONS.bob.startTime);
    expect(sessions[0]?.endTime).toBe(minimal.EXPECTED_SESSIONS.bob.endTime);
  });

  it("Charlie has one active session [T5, null)", () => {
    const charlieId = resolveMemberId(snap, "charl");
    const sessions = sessionsForMember(snap, charlieId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startTime).toBe(minimal.EXPECTED_SESSIONS.charlie.startTime);
    expect(sessions[0]?.endTime).toBeNull();
  });

  it("creates PK Private privacy bucket for Alice", () => {
    expect(snap.countByType("privacy-bucket")).toBe(1);
    const bucket = snap.find("privacy-bucket", "synthetic:pk-private");
    expect(bucket?.sourceEntityId).toBe("synthetic:pk-private");
  });

  it("PK Private bucket payload contains correct name", () => {
    const bucket = snap.find("privacy-bucket", "synthetic:pk-private");
    expect(bucket?.sourceEntityId).toBe("synthetic:pk-private");
    const payload = bucket?.payload as { encrypted: { name: string } };
    expect(payload.encrypted.name).toBe("PK Private");
  });

  it("no warnings about skipped members", () => {
    const memberSkipWarnings = warnings.filter(
      (w) => w.entityType === "member" && w.message.includes("empty name"),
    );
    expect(memberSkipWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Adversarial fixture integration tests
// ---------------------------------------------------------------------------

describe("PK Import — adversarial fixture", () => {
  let result: ImportRunResult;
  let snap: InMemoryPersisterSnapshot;
  let warnings: readonly MappingWarning[];

  beforeAll(async () => {
    const fakeData = buildFakeSourceData({
      members: adversarial.MEMBERS,
      groups: adversarial.GROUPS,
      switches: adversarial.SWITCHES,
      privacyScanMembers: adversarial.PRIVACY_SCAN_MEMBERS,
    });

    const { persister, snapshot } = createInMemoryPersister();

    result = await runPkImport({
      source: createFakeImportSource(fakeData),
      persister,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    snap = snapshot();
    warnings = result.warnings;
  });

  it("completes without aborting", () => {
    expect(result.outcome).toBe("completed");
  });

  it("skips empty-named member (4 members created, not 5)", () => {
    expect(snap.countByType("member")).toBe(4);
    expect(snap.find("member", "empty1")).toBeUndefined();
  });

  it("records non-fatal error for empty-named member", () => {
    // The PKMemberSchema requires name.min(1), so empty name fails
    // zod validation and is recorded as a non-fatal error by the engine.
    const emptyNameErrors = result.errors.filter(
      (e) => e.entityType === "member" && e.entityId === "empty1",
    );
    expect(emptyNameErrors.length).toBeGreaterThanOrEqual(1);
    expect(emptyNameErrors.every((e) => !e.fatal)).toBe(true);
  });

  it("preserves unicode names correctly", () => {
    const elise = snap.find("member", "elise1");
    expect((elise?.payload as PkMappedMember).encrypted.name).toBe("\u00c9lise");

    const cjk = snap.find("member", "cjk01");
    expect((cjk?.payload as PkMappedMember).encrypted.name).toBe("\u5149\u306e\u5b50");

    const sigma = snap.find("member", "sigma1");
    expect((sigma?.payload as PkMappedMember).encrypted.name).toBe(
      "\u03a3\u03b9\u03b3\u03bc\u03b1",
    );

    const wave = snap.find("member", "wave01");
    expect((wave?.payload as PkMappedMember).encrypted.name).toBe("\ud83c\udf0a Wave");
  });

  it("creates all 3 groups", () => {
    expect(snap.countByType("group")).toBe(3);
  });

  it("Ghost Ref Group produces warning for non-existent member", () => {
    const ghostWarnings = warnings.filter(
      (w) => w.entityType === "group" && w.message.includes("nonexistent_member_id"),
    );
    expect(ghostWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("Ghost Ref Group still created with partial membership", () => {
    const ghostGroup = snap.find("group", "grp_ghost");
    expect(ghostGroup?.sourceEntityId).toBe("grp_ghost");
    const payload = ghostGroup?.payload as PkMappedGroup;
    // Only elise1 should be resolved; nonexistent_member_id is dropped
    expect(payload.memberIds).toHaveLength(1);
  });

  it("All Members group has 4 resolved member IDs (empty-name skipped)", () => {
    const allGroup = snap.find("group", "grp_all");
    expect(allGroup?.sourceEntityId).toBe("grp_all");
    const payload = allGroup?.payload as PkMappedGroup;
    // elise1, cjk01, sigma1, wave01 — all should resolve
    expect(payload.memberIds).toHaveLength(4);
  });

  it("Empty Group has 0 member IDs", () => {
    const emptyGroup = snap.find("group", "grp_empty");
    expect(emptyGroup?.sourceEntityId).toBe("grp_empty");
    const payload = emptyGroup?.payload as PkMappedGroup;
    expect(payload.memberIds).toHaveLength(0);
  });

  it("switch referencing non-existent member produces warning", () => {
    const switchWarnings = warnings.filter(
      (w) => w.entityType === "switch" && w.message.includes("nonexistent_member_id"),
    );
    expect(switchWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("other members still have correct sessions despite non-existent ref", () => {
    // After AT5 switch ["elise1", "nonexistent_member_id"], elise should
    // still get a session since she resolves fine.
    const eliseId = resolveMemberId(snap, "elise1");
    const eliseSessions = sessionsForMember(snap, eliseId);
    // Elise appears in switches 1, 3, 5, 8, 9 — multiple sessions expected
    expect(eliseSessions.length).toBeGreaterThanOrEqual(1);
  });

  it("rapid-fire switches produce correct short sessions", () => {
    // AT1 -> AT2: elise fronts for 100ms
    // AT2 -> AT3: cjk01 fronts for 100ms
    // AT3/AT4 (duplicate): elise+cjk01 then sigma — rapid transitions
    const eliseId = resolveMemberId(snap, "elise1");
    const eliseSessions = sessionsForMember(snap, eliseId);

    // Check that at least one session has a sub-second duration
    const hasShortSession = eliseSessions.some((s) => {
      if (s.endTime === null) return false;
      return s.endTime - s.startTime < 1000;
    });
    expect(hasShortSession).toBe(true);
  });

  it("produces zero fatal errors", () => {
    const fatalCount = result.errors.filter((e) => e.fatal).length;
    expect(fatalCount).toBe(0);
  });

  it("PK Private bucket payload contains correct name", () => {
    const bucket = snap.find("privacy-bucket", "synthetic:pk-private");
    expect(bucket?.sourceEntityId).toBe("synthetic:pk-private");
    const payload = bucket?.payload as { encrypted: { name: string } };
    expect(payload.encrypted.name).toBe("PK Private");
  });
});
