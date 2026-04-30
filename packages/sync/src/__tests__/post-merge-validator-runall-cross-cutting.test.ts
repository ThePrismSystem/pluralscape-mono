/**
 * Post-merge validator — runAllValidations cross-cutting tests.
 *
 * Tests how runAllValidations aggregates results across multiple validators.
 * Per-validator dispatch tests live alongside their concern files; this file
 * exercises the multi-validator interaction paths and onError plumbing.
 *
 * Covers:
 *   - runAllValidations: empty result, tombstone+sort notifications,
 *     multi-validator run (cycle + sort), timer dispatch, onError callback,
 *     webhook dispatch
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createSystemCoreDocument } from "../factories/document-factory.js";
import { runAllValidations } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import {
  makeArchivedMember,
  makeGroup,
  makeKeys,
  makeSessions,
  makeTimer,
  makeWebhookSession,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asGroupId, asMemberId, asSyncDocId, asTimerId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── runAllValidations (module-level function) ─────────────────────────

describe("runAllValidations (module-level function)", () => {
  let relay: EncryptedRelay;

  beforeEach(() => {
    keys = makeKeys();
    relay = new EncryptedRelay();
  });

  it("returns aggregate results from all validators including notifications", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-all-valid"),
      sodium,
    });

    // No issues to fix
    const result = runAllValidations(session);

    expect(result.cycleBreaks).toHaveLength(0);
    expect(result.sortOrderPatches).toHaveLength(0);
    expect(result.checkInNormalizations).toBe(0);
    expect(result.friendConnectionNormalizations).toBe(0);
    expect(result.timerConfigNormalizations).toBe(0);
    expect(result.correctionEnvelopes).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns correctionEnvelopes and notifications when issues exist", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-all-with-issues"),
      sodium,
    });

    // Add an archived member (will trigger tombstone enforcement)
    session.change((d) => {
      d.members[asMemberId("mem_1")] = makeArchivedMember("mem_1");
    });

    const result = runAllValidations(session);

    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.notifications).toEqual(
      expect.arrayContaining([expect.objectContaining({ resolution: "lww-field" })]),
    );
    expect(result.errors).toHaveLength(0);
  });

  it("includes cycle break and sort order notifications in result.notifications", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-notif-test"));

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grpA")] = makeGroup("grpA", 5);
      d.groups[asGroupId("grpB")] = makeGroup("grpB", 5);
      d.groups[asGroupId("grpC")] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r7 = await relay.getEnvelopesSince(asSyncDocId("doc-notif-test"), 0);
    sessionB.applyEncryptedChanges(_r7.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grpA")];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grpC")];
      if (g) g.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const result = runAllValidations(sessionA);

    const cycleNotifications = result.notifications.filter(
      (n) => n.resolution === "post-merge-cycle",
    );
    const sortNotifications = result.notifications.filter(
      (n) => n.resolution === "post-merge-sort-normalize",
    );

    expect(cycleNotifications.length).toBeGreaterThan(0);
    expect(sortNotifications.length).toBeGreaterThan(0);

    const tombstoneCount = result.notifications.filter((n) => n.resolution === "lww-field").length;
    expect(result.notifications.length).toBe(
      tombstoneCount + result.cycleBreaks.length + result.sortOrderPatches.length,
    );
    expect(result.errors).toHaveLength(0);
  });

  it("handles both sort order ties and parent cycles in same run", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-multi-validator"));

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grpA")] = makeGroup("grpA", 5);
      d.groups[asGroupId("grpB")] = makeGroup("grpB", 5); // tie with grpA
      d.groups[asGroupId("grpC")] = makeGroup("grpC", 3);
    });
    await relay.submit(seedEnv);
    const _r8 = await relay.getEnvelopesSince(asSyncDocId("doc-multi-validator"), 0);
    sessionB.applyEncryptedChanges(_r8.envelopes);

    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grpA")];
      if (g) g.parentGroupId = s("grpC");
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grpC")];
      if (g) g.parentGroupId = s("grpA");
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    const result = runAllValidations(sessionA);

    expect(result.cycleBreaks.length).toBeGreaterThan(0);
    expect(result.sortOrderPatches.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it("normalizes invalid timer configs via runAllValidations dispatch", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-all-valid"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_invalid")] = makeTimer("tmr_invalid", { intervalMinutes: -5 });
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(session.document.timers[asTimerId("tmr_invalid")]?.enabled).toBe(false);
  });

  it("populates errors array and calls onError when no callback swallows", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-onerror-test"),
      sodium,
    });

    session.change((d) => {
      d.members[asMemberId("mem_1")] = makeArchivedMember("mem_1");
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 5);
      const grp2 = makeGroup("grp_2", 5);
      grp2.createdAt = 900;
      d.groups[asGroupId("grp_2")] = grp2;
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.sortOrderPatches.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(errorMessages).toHaveLength(0);
  });
});

// ── runAllValidations: onError callback invocation ───────────────────

describe("runAllValidations: onError callback invocation", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("dispatches webhook config validation via runAllValidations and reports issues", () => {
    const session = makeWebhookSession(keys, "doc-run-webhook-dispatch");

    session.change((d) => {
      d.webhookConfigs["wh_dispatch"] = {
        url: s("ftp://bad-protocol.example.com"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });

    const result = runAllValidations(session as EncryptedSyncSession<unknown>);

    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.fieldName === "url")).toBe(true);
  });

  it("dispatches timer config validation via runAllValidations for waking-hours edge case", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-timer-waking"),
      sodium,
    });

    session.change((d) => {
      d.timers[asTimerId("tmr_waking")] = makeTimer("tmr_waking", {
        wakingHoursOnly: true,
        wakingStart: s("10:00"),
        wakingEnd: s("10:00"),
      });
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.fieldName === "wakingHours")).toBe(true);
    expect(errorMessages).toHaveLength(0);
  });
});
