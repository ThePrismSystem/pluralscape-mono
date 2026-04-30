/**
 * Post-merge validator — fronting-session normalization tests.
 *
 * Covers:
 *   - normalizeFrontingSessions: endTime fixup, orphan-subject notification,
 *     valid-session no-op, empty-sessions no-op, mixed valid/invalid
 *   - normalizeFrontingSessions additional edge cases: exact endTime==startTime,
 *     customFrontId-only, structureEntityId-only, both violations
 *   - normalizeFrontingSessions: missing-field early return
 *   - runAllValidations dispatch: frontingSessionNormalizations counter
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFrontingDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { normalizeFrontingSessions, runAllValidations } from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import {
  makeFrontingSession,
  makeKeys,
  newFsId,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeFrontingSessions ─────────────────────────────────────────

describe("PostMergeValidator: normalizeFrontingSessions", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("nulls endTime when endTime <= startTime and emits notification with post-merge-endtime-normalize resolution", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-endtime"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, { startTime: 2000, endTime: 1000 });
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    expect(envelope).not.toBeNull();
    expect(session.document.sessions[sessionId]?.endTime).toBeNull();

    const endTimeNotification = notifications.find(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    expect(endTimeNotification?.entityId).toBe(sessionId);
    expect(endTimeNotification?.fieldName).toBe("endTime");
  });

  it("emits notification-only resolution when subject is missing (all null) without mutating", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-no-subject"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, { memberId: s("mem_placeholder") });
    });
    // Null out memberId to simulate CRDT merge artifact (all subjects missing)
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(envelope).toBeNull();

    const subjectNotification = notifications.find((n) => n.resolution === "notification-only");
    expect(subjectNotification?.entityId).toBe(sessionId);
    expect(subjectNotification?.fieldName).toBe("subject");
  });

  it("returns count=0 and no notifications for a valid session", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-valid"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId);
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });

  it("returns count=0 and envelope=null for empty sessions map", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-empty"),
      sodium,
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
    expect(envelope).toBeNull();
  });

  it("fixes only invalid sessions in a mixed valid + invalid set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-mixed"),
      sodium,
    });

    const validId = newFsId();
    const invalidId = newFsId();
    const noSubjectId = newFsId();

    session.change((d) => {
      // Valid session: endTime > startTime, has subject
      d.sessions[validId] = makeFrontingSession(validId);
      // Invalid endTime: endTime <= startTime
      d.sessions[invalidId] = makeFrontingSession(invalidId, {
        memberId: s("mem_2"),
        startTime: 3000,
        endTime: 2000,
      });
      // Missing subject: no mutation, notification only
      d.sessions[noSubjectId] = makeFrontingSession(noSubjectId, {
        memberId: s("mem_placeholder"),
        startTime: 1000,
        endTime: 8000,
      });
    });
    // Null out memberId on noSubjectId to simulate CRDT merge artifact
    session.change((d) => {
      const target = d.sessions[noSubjectId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    expect(envelope).not.toBeNull();

    expect(session.document.sessions[invalidId]?.endTime).toBeNull();
    expect(session.document.sessions[validId]?.endTime).toBe(5000);
    expect(session.document.sessions[noSubjectId]?.endTime).toBe(8000);

    const endTimeNotifications = notifications.filter(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    const subjectNotifications = notifications.filter((n) => n.resolution === "notification-only");
    expect(endTimeNotifications).toHaveLength(1);
    expect(endTimeNotifications[0]?.entityId).toBe(invalidId);
    expect(subjectNotifications).toHaveLength(1);
    expect(subjectNotifications[0]?.entityId).toBe(noSubjectId);
  });
});

// ── normalizeFrontingSessions: additional edge cases ──────────────────

describe("normalizeFrontingSessions: additional edge cases", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("nulls endTime when endTime exactly equals startTime", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-eq-endtime"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, { startTime: 3000, endTime: 3000 });
    });

    const { count, notifications, envelope } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    expect(envelope).not.toBeNull();
    expect(session.document.sessions[sessionId]?.endTime).toBeNull();
    expect(notifications.some((n) => n.resolution === "post-merge-endtime-normalize")).toBe(true);
  });

  it("emits no notification for session with only customFrontId set (no member/structureEntity)", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-custom-only"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, {
        memberId: s("mem_placeholder"),
        customFrontId: s("cf_1"),
        structureEntityId: s(""),
        comment: s(""),
        positionality: s(""),
        outtrigger: s(""),
        outtriggerSentiment: s(""),
      });
    });
    // Null out memberId to exercise the customFrontId-only path
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("emits no notification for session with only structureEntityId set", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-entity-only"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, {
        memberId: s("mem_placeholder"),
        customFrontId: s("cf_placeholder"),
        structureEntityId: s("ste_1"),
        comment: s(""),
        positionality: s(""),
        outtrigger: s(""),
        outtriggerSentiment: s(""),
      });
    });
    // Null out memberId and customFrontId to exercise structureEntityId-only path
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate CRDT merge state
      if (target) target.memberId = null;
      if (target) target.customFrontId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("handles both endTime violation and orphan subject on the same session", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fronting-both-violations"),
      sodium,
    });

    const sessionId = newFsId();
    session.change((d) => {
      d.sessions[sessionId] = makeFrontingSession(sessionId, {
        memberId: s("mem_placeholder"),
        startTime: 5000,
        endTime: 2000,
      });
    });
    // Null out memberId to make it an orphan too
    session.change((d) => {
      const target = d.sessions[sessionId];
      // @ts-expect-error -- deliberately setting to null to simulate invalid CRDT merge state
      if (target) target.memberId = null;
    });

    const { count, notifications } = normalizeFrontingSessions(session);

    expect(count).toBe(1);
    const endTimeNotif = notifications.filter(
      (n) => n.resolution === "post-merge-endtime-normalize",
    );
    const subjectNotif = notifications.filter((n) => n.resolution === "notification-only");
    expect(endTimeNotif).toHaveLength(1);
    expect(subjectNotif).toHaveLength(1);
  });

  it("returns count=0 when document has no sessions field", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-fs-no-field"),
      sodium,
    });

    const result = normalizeFrontingSessions(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });
});

// ── runAllValidations: fronting-session dispatch ───────────────────────

describe("runAllValidations: frontingSession dispatch", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("populates frontingSessionNormalizations and emits envelope when endTime is invalid", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-fronting-fix"),
      sodium,
    });

    const fsId = newFsId();
    session.change((d) => {
      d.sessions[fsId] = makeFrontingSession(fsId, { startTime: 5000, endTime: 1000 });
    });

    const result = runAllValidations(session);

    expect(result.frontingSessionNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
  });
});
