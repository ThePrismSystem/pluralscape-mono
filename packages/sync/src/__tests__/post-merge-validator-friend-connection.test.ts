/**
 * Post-merge validator — friend-connection normalization tests.
 *
 * Covers:
 *   - normalizeFriendConnection: accepted-status re-stamp, no-op path
 *   - normalizeFriendConnection: visibility-only evidence, no-evidence, bad JSON,
 *     both-buckets-and-visibility, missing-field early return
 *   - runAllValidations dispatch: friendConnectionNormalizations counter and notification
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { normalizeFriendConnection, runAllValidations } from "../post-merge-validator.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import { makeKeys, makeSessions, s, setSodium } from "./helpers/validator-fixtures.js";
import { asBucketId, asFriendConnectionId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeFriendConnection ─────────────────────────────────────────

describe("PostMergeValidator: normalizeFriendConnection", () => {
  let relay: EncryptedRelay;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys();
  });

  it("re-stamps accepted when status reverted to pending from accepted", async () => {
    const base = createPrivacyConfigDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-friend-norm"));

    // Seed with accepted status and assigned buckets (evidence of prior acceptance)
    const seedEnv = sessionA.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_1")] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: { [asBucketId("bkt_1")]: true },
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    await relay.submit(seedEnv);
    const seedReplay = await relay.getEnvelopesSince(asSyncDocId("doc-friend-norm"), 0);
    sessionB.applyEncryptedChanges(seedReplay.envelopes);

    // B sets status to pending while A keeps accepted
    const envA = sessionA.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) fc.updatedAt = 2000;
    });
    const envB = sessionB.change((d) => {
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) {
        fc.status = s("pending");
        fc.updatedAt = 2001;
      }
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // The LWW may pick B's pending status
    const { count } = normalizeFriendConnection(sessionA);

    // After normalization, status should be accepted
    // (the normalizer detects pending with assigned buckets and re-stamps)
    expect(sessionA.document.friendConnections[asFriendConnectionId("fc_1")]?.status.val).toBe(
      "accepted",
    );
    expect(count).toBe(1);
  });

  it("returns 0 when no normalization needed", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-ok"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_1")] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: {},
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);
    expect(count).toBe(0);
  });
});

// ── normalizeFriendConnection: additional branch coverage ─────────────

describe("normalizeFriendConnection: additional branch coverage", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("fixes pending connection that has visibility-only evidence (no assigned buckets)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-vis-only"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_vis")] = {
        id: s("fc_vis"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);

    expect(count).toBe(1);
    expect(session.document.friendConnections[asFriendConnectionId("fc_vis")]?.status.val).toBe(
      "accepted",
    );
  });

  it("does not fix pending connection with empty buckets and empty visibility", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-no-evidence"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_noev")] = {
        id: s("fc_noev"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count, envelope } = normalizeFriendConnection(session);

    expect(count).toBe(0);
    expect(envelope).toBeNull();
  });

  it("handles invalid JSON in visibility gracefully (catch branch sets hasVisibility=false)", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-bad-json"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_badvis")] = {
        id: s("fc_badvis"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: {},
        visibility: s("NOT_VALID_JSON{{{"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    // Invalid JSON + no buckets → hasVisibility=false, hasAssignedBuckets=false → no fix
    const { count, envelope } = normalizeFriendConnection(session);
    expect(count).toBe(0);
    expect(envelope).toBeNull();
  });

  it("fixes pending connection with both buckets and valid visibility", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-both"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_both")] = {
        id: s("fc_both"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: { [asBucketId("bkt_x")]: true },
        visibility: s('{"showMembers":true}'),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const { count } = normalizeFriendConnection(session);
    expect(count).toBe(1);
  });

  it("returns count=0 when document has no friendConnections field", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-friend-no-field"),
      sodium,
    });

    const result = normalizeFriendConnection(session as EncryptedSyncSession<unknown>);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });
});

// ── runAllValidations: friend-connection dispatch ─────────────────────

describe("runAllValidations: friendConnection dispatch", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("populates friendConnectionNormalizations and emits batch notification when connection needs fix", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-run-friend-fix"),
      sodium,
    });

    session.change((d) => {
      d.friendConnections[asFriendConnectionId("fc_run")] = {
        id: s("fc_run"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("pending"),
        assignedBuckets: { [asBucketId("bkt_y")]: true },
        visibility: s("{}"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });

    const result = runAllValidations(session);

    expect(result.friendConnectionNormalizations).toBe(1);
    expect(result.correctionEnvelopes.length).toBeGreaterThan(0);
    expect(result.notifications.some((n) => n.resolution === "post-merge-friend-status")).toBe(
      true,
    );
  });
});
