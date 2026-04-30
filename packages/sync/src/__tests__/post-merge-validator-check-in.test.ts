/**
 * Post-merge validator — check-in record normalization tests.
 *
 * Covers:
 *   - normalizeCheckInRecord: responded-while-dismissed conflict, no-op path
 *   - normalizeCheckInRecord: missing-field early return
 *   - runAllValidations dispatch: checkInNormalizations counter and notification
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createPrivacyConfigDocument,
} from "../factories/document-factory.js";
import { normalizeCheckInRecord, runAllValidations } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { makeKeys, makeSessions, s, setSodium } from "./helpers/validator-fixtures.js";
import { asCheckInRecordId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeCheckInRecord ────────────────────────────────────────────

describe("PostMergeValidator: normalizeCheckInRecord", () => {
  let relay: EncryptedRelay;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("sets dismissed = false when respondedByMemberId is set and dismissed is true", async () => {
    const base = createFrontingDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-checkin-norm"));

    const seedEnv = sessionA.change((d) => {
      d.checkInRecords[asCheckInRecordId("cr_1")] = {
        id: s("cr_1"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: null,
        respondedAt: null,
        dismissed: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const seedReplay = await relay.getEnvelopesSince(asSyncDocId("doc-checkin-norm"), 0);
    sessionB.applyEncryptedChanges(seedReplay.envelopes);

    // A responds, B dismisses concurrently
    const envA = sessionA.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (cr) {
        cr.respondedByMemberId = s("mem_1");
        cr.respondedAt = 1100;
      }
    });
    const envB = sessionB.change((d) => {
      const cr = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (cr) {
        cr.dismissed = true;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const { count } = normalizeCheckInRecord(sessionA);

    const cr = sessionA.document.checkInRecords[asCheckInRecordId("cr_1")];
    expect(cr?.respondedByMemberId).not.toBeNull();
    expect(cr?.dismissed).toBe(false);
    expect(count).toBe(1);
  });

  it("returns 0 when no normalization needed", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-checkin-ok"),
      sodium,
    });

    session.change((d) => {
      d.checkInRecords[asCheckInRecordId("cr_1")] = {
        id: s("cr_1"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: s("mem_1"),
        respondedAt: 1100,
        dismissed: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeCheckInRecord(session);
    expect(count).toBe(0);
  });

  it("returns count=0 when document has no checkInRecords field", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-checkin-no-field"),
      sodium,
    });

    const result = normalizeCheckInRecord(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });
});

// ── runAllValidations: check-in dispatch ─────────────────────────────

describe("runAllValidations: checkIn dispatch", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("populates checkInNormalizations and emits batch notification when check-in record needs fix", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-checkin-fix"),
      sodium,
    });

    session.change((d) => {
      d.checkInRecords[asCheckInRecordId("cr_fix")] = {
        id: s("cr_fix"),
        timerConfigId: s("t_1"),
        systemId: s("sys_1"),
        scheduledAt: 1000,
        respondedByMemberId: s("mem_1"),
        respondedAt: 1100,
        dismissed: true,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const result = runAllValidations(session);

    expect(result.checkInNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-checkin-normalize")).toBe(
      true,
    );
  });
});
