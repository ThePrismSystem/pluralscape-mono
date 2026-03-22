/**
 * CRDT sync tests for timer configs and check-in records.
 *
 * Verifies merge conflict resolution and post-merge validation:
 * - Timer config LWW field-level conflict resolution
 * - Timer config post-merge validation (waking hours, intervalMinutes)
 * - Check-in record respond/dismiss conflict resolution
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFrontingDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { normalizeCheckInRecord, normalizeTimerConfig } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { ENTITY_CRDT_STRATEGIES } from "../strategies/crdt-strategies.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { asSyncDocId } from "./test-crypto-helpers.js";

import type { CrdtCheckInRecord } from "../schemas/fronting.js";
import type { CrdtTimer } from "../schemas/system-core.js";
import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";
import type { SyncDocumentId } from "@pluralscape/types";

// ── helpers ──────────────────────────────────────────────────────────

const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

function makeKeys(): DocumentKeys {
  return {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys: sodium.signKeypair(),
  };
}

function makeSessions<T>(
  base: Automerge.Doc<T>,
  keys: DocumentKeys,
  docId: SyncDocumentId,
): [EncryptedSyncSession<T>, EncryptedSyncSession<T>] {
  return [
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
    new EncryptedSyncSession({ doc: Automerge.clone(base), keys, documentId: docId, sodium }),
  ];
}

function makeTimer(id: string, overrides?: Partial<CrdtTimer>): CrdtTimer {
  return {
    id: s(id),
    systemId: s("sys_1"),
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    promptText: s("How are you?"),
    enabled: true,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeCheckIn(id: string, overrides?: Partial<CrdtCheckInRecord>): CrdtCheckInRecord {
  return {
    id: s(id),
    timerConfigId: s("tmr_1"),
    systemId: s("sys_1"),
    scheduledAt: 1000,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── CRDT strategy registry ───────────────────────────────────────────

describe("Timer CRDT strategies", () => {
  it("timer strategy is lww-map in system-core", () => {
    const strategy = ENTITY_CRDT_STRATEGIES["timer"];
    expect(strategy.storageType).toBe("lww-map");
    expect(strategy.document).toBe("system-core");
    expect(strategy.fieldName).toBe("timers");
  });

  it("check-in-record strategy is append-lww in fronting document", () => {
    const strategy = ENTITY_CRDT_STRATEGIES["check-in-record"];
    expect(strategy.storageType).toBe("append-lww");
    expect(strategy.document).toBe("fronting");
    expect(strategy.fieldName).toBe("checkInRecords");
  });
});

// ── Timer config LWW conflicts ───────────────────────────────────────

describe("Timer config merge conflicts", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("resolves concurrent field edits via LWW (last writer wins)", async () => {
    const base = createSystemCoreDocument();
    const docId = asSyncDocId("doc-timer-lww");
    const [sessionA, sessionB] = makeSessions(base, keys, docId);

    // Seed a timer config
    const seedEnv = sessionA.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1");
    });
    await relay.submit(seedEnv);
    const r1 = await relay.getEnvelopesSince(docId, 0);
    sessionB.applyEncryptedChanges(r1.envelopes);

    // A changes interval to 60, B changes interval to 15 concurrently
    const envA = sessionA.change((d) => {
      const t = d.timers["tmr_1"];
      if (t) {
        t.intervalMinutes = 60;
        t.updatedAt = 2000;
      }
    });
    const envB = sessionB.change((d) => {
      const t = d.timers["tmr_1"];
      if (t) {
        t.intervalMinutes = 15;
        t.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // After merge, both sessions should agree on the value (LWW)
    expect(sessionA.document.timers["tmr_1"]?.intervalMinutes).toBe(
      sessionB.document.timers["tmr_1"]?.intervalMinutes,
    );
  });
});

// ── Timer config post-merge validation ───────────────────────────────

describe("normalizeTimerConfig", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("disables timer when intervalMinutes <= 0 after merge", () => {
    const base = createSystemCoreDocument();
    const docId = asSyncDocId("doc-timer-interval");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: -5 });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.envelope).not.toBeNull();
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("intervalMinutes");

    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });

  it("disables timer when wakingHoursOnly=true but wakingStart >= wakingEnd", () => {
    const base = createSystemCoreDocument();
    const docId = asSyncDocId("doc-timer-waking");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("22:00"),
        wakingEnd: s("08:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.notifications[0]?.fieldName).toBe("wakingHours");
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });

  it("does not modify valid timer configs", () => {
    const base = createSystemCoreDocument();
    const docId = asSyncDocId("doc-timer-valid");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });

  it("disables timer when wakingHoursOnly=true but wakingStart is null", () => {
    const base = createSystemCoreDocument();
    const docId = asSyncDocId("doc-timer-null-start");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: s("22:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });
});

// ── Check-in record conflict resolution ──────────────────────────────

describe("Check-in record merge conflicts", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("normalizes check-in where both responded and dismissed after merge", () => {
    const base = createFrontingDocument();
    const docId = asSyncDocId("doc-checkin-conflict");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.checkInRecords["cir_1"] = makeCheckIn("cir_1", {
        respondedByMemberId: s("mem_1"),
        respondedAt: 2000,
        dismissed: true,
      });
    });

    const result = normalizeCheckInRecord(session);

    // Response takes priority over dismissal
    expect(result.count).toBe(1);
    expect(result.envelope).not.toBeNull();
    expect(session.document.checkInRecords["cir_1"]?.dismissed).toBe(false);
  });

  it("does not modify check-in that is only responded", () => {
    const base = createFrontingDocument();
    const docId = asSyncDocId("doc-checkin-ok");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.checkInRecords["cir_1"] = makeCheckIn("cir_1", {
        respondedByMemberId: s("mem_1"),
        respondedAt: 2000,
      });
    });

    const result = normalizeCheckInRecord(session);
    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });

  it("does not modify check-in that is only dismissed", () => {
    const base = createFrontingDocument();
    const docId = asSyncDocId("doc-checkin-dismissed");
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: docId,
      sodium,
    });

    session.change((d) => {
      d.checkInRecords["cir_1"] = makeCheckIn("cir_1", {
        dismissed: true,
      });
    });

    const result = normalizeCheckInRecord(session);
    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });
});
