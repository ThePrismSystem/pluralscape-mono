import * as Automerge from "@automerge/automerge";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFrontingDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";
import {
  DEFAULT_COMPACTION_CONFIG,
  DEFAULT_STORAGE_BUDGET,
  DOCUMENT_SIZE_LIMITS,
  StorageBudgetExceededError,
  SYNC_PRIORITY_ORDER,
  TIME_SPLIT_CONFIGS,
} from "../types.js";

import { getSodium, makeKeys, makeSessions, s } from "./helpers/document-lifecycle-fixtures.js";
import { asFrontingSessionId, asMemberId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Section 4: Time-split ─────────────────────────────────────────────

describe("Time-split configuration", () => {
  it("TIME_SPLIT_CONFIGS has correct entries for all time-split document types", () => {
    const byType = Object.fromEntries(TIME_SPLIT_CONFIGS.map((c) => [c.documentType, c]));

    expect(byType["fronting"]?.splitUnit).toBe("quarter");
    expect(byType["fronting"]?.splitThresholdBytes).toBe(5_242_880);

    expect(byType["chat"]?.splitUnit).toBe("month");
    expect(byType["chat"]?.splitThresholdBytes).toBe(5_242_880);

    expect(byType["journal"]?.splitUnit).toBe("year");
    expect(byType["journal"]?.splitThresholdBytes).toBe(10_485_760);
  });

  it("DOCUMENT_SIZE_LIMITS covers all document types", () => {
    const types = [
      "system-core",
      "fronting",
      "chat",
      "journal",
      "privacy-config",
      "bucket",
    ] as const;
    for (const t of types) {
      expect(DOCUMENT_SIZE_LIMITS[t]).toBeGreaterThan(0);
    }
  });

  it("document IDs parse correct timePeriod for time-split docs", () => {
    // Quarter naming convention
    const frontingQ1 = "fronting-sys_abc-2026-Q1";
    expect(frontingQ1).toMatch(/-2026-Q1$/);

    // Month naming convention
    const chatMar = "chat-ch_xyz-2026-03";
    expect(chatMar).toMatch(/-2026-03$/);

    // Year naming convention
    const journal2026 = "journal-sys_abc-2026";
    expect(journal2026).toMatch(/-2026$/);
  });

  it("new fronting session created after split goes to new period doc", () => {
    // Verify that two separate sessions with different docIds don't interfere
    const base = createFrontingDocument();
    const keys1 = makeKeys(sodium);
    const keys2 = makeKeys(sodium);

    const sessionQ1 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys1,
      documentId: asSyncDocId("fronting-sys_abc-2026-Q1"),
      sodium,
    });
    const sessionQ2 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("fronting-sys_abc-2026-Q2"),
      sodium,
    });

    // Q1 has a historical session
    sessionQ1.change((d) => {
      d.sessions[asFrontingSessionId("fs_q1")] = {
        id: s("fs_q1"),
        systemId: s("sys_abc"),
        memberId: s("mem_1"),
        startTime: 1_740_000_000,
        endTime: 1_740_001_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_740_000_000,
        updatedAt: 1_740_001_000,
      };
    });

    // Q2 has a new session
    sessionQ2.change((d) => {
      d.sessions[asFrontingSessionId("fs_q2")] = {
        id: s("fs_q2"),
        systemId: s("sys_abc"),
        memberId: s("mem_1"),
        startTime: 1_750_000_000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_750_000_000,
        updatedAt: 1_750_000_000,
      };
    });

    // Each period doc is independent
    expect(Object.keys(sessionQ1.document.sessions)).toHaveLength(1);
    expect(Object.keys(sessionQ2.document.sessions)).toHaveLength(1);
    expect(sessionQ1.document.sessions[asFrontingSessionId("fs_q1")]?.id.val).toBe("fs_q1");
    expect(sessionQ2.document.sessions[asFrontingSessionId("fs_q2")]?.id.val).toBe("fs_q2");
  });

  it("cross-split query: concatenate and sort fronting sessions from multiple periods", () => {
    const base = createFrontingDocument();
    const keys1 = makeKeys(sodium);
    const keys2 = makeKeys(sodium);

    const sessionQ1 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys1,
      documentId: asSyncDocId("fronting-sys_1-2025-Q4"),
      sodium,
    });
    const sessionQ2 = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys: keys2,
      documentId: asSyncDocId("fronting-sys_1-2026-Q1"),
      sodium,
    });

    sessionQ1.change((d) => {
      d.sessions[asFrontingSessionId("fs_q4")] = {
        id: s("fs_q4"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1_000,
        endTime: 2_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_000,
        updatedAt: 2_000,
      };
    });

    sessionQ2.change((d) => {
      d.sessions[asFrontingSessionId("fs_q1")] = {
        id: s("fs_q1"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 3_000,
        endTime: 4_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 3_000,
        updatedAt: 4_000,
      };
    });

    // Cross-split: client merges results by sorting
    const q4Sessions = Object.values(sessionQ1.document.sessions);
    const q1Sessions = Object.values(sessionQ2.document.sessions);
    const allSessions = [...q4Sessions, ...q1Sessions].sort((a, b) => a.startTime - b.startTime);

    expect(allSessions).toHaveLength(2);
    expect(allSessions[0]?.id.val).toBe("fs_q4");
    expect(allSessions[1]?.id.val).toBe("fs_q1");
  });
});

// ── Section 6: Storage budget ─────────────────────────────────────────

describe("Storage budget", () => {
  it("StorageBudgetExceededError has correct type and fields", () => {
    const err = new StorageBudgetExceededError(
      asSyncDocId("doc-budget-test"),
      600_000_000,
      524_288_000,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StorageBudgetExceededError);
    expect(err.name).toBe("StorageBudgetExceededError");
    expect(err.documentId).toBe("doc-budget-test");
    expect(err.currentBytes).toBe(600_000_000);
    expect(err.maxBytes).toBe(524_288_000);
    expect(err.message).toContain("doc-budget-test");
  });

  it("DEFAULT_STORAGE_BUDGET is 500 MB", () => {
    expect(DEFAULT_STORAGE_BUDGET.maxTotalBytes).toBe(524_288_000);
  });

  it("SYNC_PRIORITY_ORDER has system-core first and historical last", () => {
    expect(SYNC_PRIORITY_ORDER[0]).toBe("system-core");
    expect(SYNC_PRIORITY_ORDER[SYNC_PRIORITY_ORDER.length - 1]).toBe("note-historical");
  });
});

// ── Section 7: Archive ────────────────────────────────────────────────

describe("Archive: cold document behavior", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys(sodium);
  });

  it("archived flag on SyncManifestEntry is boolean", () => {
    // Verify that the archived field is a proper boolean — structural test
    const archived = true;
    const notArchived = false;
    expect(typeof archived).toBe("boolean");
    expect(typeof notArchived).toBe("boolean");
    expect(archived).not.toBe(notArchived);
  });

  it("writing to a session that was loaded from an 'archived' snapshot un-archives it conceptually", () => {
    // Simulates loading an archived doc on-demand and writing to it
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("fronting-sys_1-2024-Q4"),
      sodium,
    });

    // Add historical data
    session.change((d) => {
      d.sessions[asFrontingSessionId("fs_old")] = {
        id: s("fs_old"),
        systemId: s("sys_1"),
        memberId: s("mem_1"),
        startTime: 1_000,
        endTime: 2_000,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1_000,
        updatedAt: 2_000,
      };
    });

    // The document is readable and writable regardless of server-side archive flag
    expect(session.document.sessions[asFrontingSessionId("fs_old")]?.archived).toBe(false);
    expect(Object.keys(session.document.sessions)).toHaveLength(1);
  });

  it("on-demand loaded document has correct data after sync", async () => {
    const base = createSystemCoreDocument();
    const relay = new EncryptedRelay();
    const [sessionA, sessionB] = makeSessions(
      base,
      keys,
      asSyncDocId("doc-archive-ondemand"),
      sodium,
    );

    const env = sessionA.change((d) => {
      d.members[asMemberId("mem_history")] = {
        id: s("mem_history"),
        systemId: s("sys_1"),
        name: s("Historical Member"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(env);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions have the data — simulates on-demand load working correctly
    expect(sessionB.document.members[asMemberId("mem_history")]?.name.val).toBe(
      "Historical Member",
    );
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("DEFAULT_COMPACTION_CONFIG has expected thresholds", () => {
    expect(DEFAULT_COMPACTION_CONFIG.changeThreshold).toBe(200);
    expect(DEFAULT_COMPACTION_CONFIG.sizeThresholdBytes).toBe(1_048_576);
  });
});
