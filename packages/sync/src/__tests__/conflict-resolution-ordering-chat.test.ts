import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createChatDocument, createSystemCoreDocument } from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { syncThroughRelay } from "../sync-session.js";

import {
  getSodium,
  makeGroup,
  makeKeys,
  makeSessions,
  s,
} from "./helpers/conflict-resolution-fixtures.js";
import { asGroupId, asSyncDocId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = await getSodium();
});

// ── Category 8: Sort order conflicts ─────────────────────────────────
//
// After merge, LWW picks a winner for each sortOrder independently.
// Ties or inversions in the merged set are normal — post-merge normalization
// (re-numbering to eliminate ties and fill gaps) is application-layer.

describe("Category 8: sort order conflicts", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("8a — concurrent sort order reorders converge to a consistent (possibly inverted) state", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-cr-008"), sodium);

    // Seed 3 groups with sortOrder 1, 2, 3
    const seedEnv = sessionA.change((d) => {
      for (const [id, order] of [
        ["grp_1", 1],
        ["grp_2", 2],
        ["grp_3", 3],
      ] as const) {
        d.groups[asGroupId(id)] = makeGroup(id, order);
      }
    });
    await relay.submit(seedEnv);
    const _r8 = await relay.getEnvelopesSince(asSyncDocId("doc-cr-008"), 0);
    sessionB.applyEncryptedChanges(_r8.envelopes);

    // Session A: swap grp_1 and grp_3 (3→1, 1→3)
    const envA = sessionA.change((d) => {
      const g1 = d.groups[asGroupId("grp_1")];
      const g3 = d.groups[asGroupId("grp_3")];
      if (g1) g1.sortOrder = 3;
      if (g3) g3.sortOrder = 1;
    });
    // Session B: swap grp_2 and grp_1 (2→1, 1→2) — concurrent
    const envB = sessionB.change((d) => {
      const g1 = d.groups[asGroupId("grp_1")];
      const g2 = d.groups[asGroupId("grp_2")];
      if (g1) g1.sortOrder = 2;
      if (g2) g2.sortOrder = 1;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge to the same state
    expect(sessionA.document).toEqual(sessionB.document);

    // Each group has some sortOrder — LWW picked a winner per field.
    // Ties or inversions may exist; post-merge normalization (re-numbering)
    // is application-layer.
    const orders = ["grp_1", "grp_2", "grp_3"].map(
      (id) => sessionA.document.groups[asGroupId(id)]?.sortOrder,
    );
    expect(orders).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
  });
});

// ── Category 9: ChatMessage edit chain ────────────────────────────────
//
// Messages are append-only and immutable. Edits produce new entries with
// `editOf` referencing the original message ID. The edit chain is resolved
// at the application layer by following editOf links.

describe("Category 9: ChatMessage edit chain", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("9a — concurrent edit message and unrelated append both present; edit chain intact", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-chat-009"), sodium);

    // Session A appends msg_1, then syncs to B
    const seedEnv = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Original content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    await relay.submit(seedEnv);
    const _r9 = await relay.getEnvelopesSince(asSyncDocId("doc-chat-009"), 0);
    sessionB.applyEncryptedChanges(_r9.envelopes);

    // Session A posts an edit (msg_2 with editOf = msg_1)
    const envA = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_2"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edited content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    // Session B concurrently appends an unrelated message (msg_3)
    const envB = sessionB.change((d) => {
      d.messages.push({
        id: s("msg_3"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_2"),
        content: s("Unrelated message"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1050,
        editOf: null,
        archived: false,
      });
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    // Both sessions converge
    expect(sessionA.document).toEqual(sessionB.document);

    // All 3 messages are present
    const ids = sessionA.document.messages.map((m) => m.id.val);
    expect(ids).toContain("msg_1");
    expect(ids).toContain("msg_2");
    expect(ids).toContain("msg_3");
    expect(sessionA.document.messages).toHaveLength(3);

    // Edit chain is intact: msg_2.editOf references msg_1
    const msg2 = sessionA.document.messages.find((m) => m.id.val === "msg_2");
    expect(msg2).toMatchObject({
      id: expect.objectContaining({ val: "msg_2" }),
    });
    expect(msg2?.editOf?.val).toBe("msg_1");
  });
});

// ── Multi-level chat edit chains ──────────────────────────────────────

describe("Multi-level chat edit chains", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("multi-level edit chain (msg_1 → msg_2 → msg_3) is preserved after sync", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-edit-chain"), sodium);

    // Build a 3-level edit chain on A
    const env1 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 1"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    const env2 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_2"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 2"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    const env3 = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_3"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Version 3"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1200,
        editOf: s("msg_2"),
        archived: false,
      });
    });

    await relay.submit(env1);
    await relay.submit(env2);
    await relay.submit(env3);
    await syncThroughRelay([sessionA, sessionB], relay);

    const msgs = sessionB.document.messages;
    expect(msgs).toHaveLength(3);
    const msg3 = msgs.find((m) => m.id.val === "msg_3");
    expect(msg3?.editOf?.val).toBe("msg_2");
    const msg2 = msgs.find((m) => m.id.val === "msg_2");
    expect(msg2?.editOf?.val).toBe("msg_1");
  });

  it("concurrent edits to same original message produce parallel edit chains", async () => {
    const base = createChatDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-edit-parallel"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Original"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    await relay.submit(seedEnv);
    const _r16 = await relay.getEnvelopesSince(asSyncDocId("doc-edit-parallel"), 0);
    sessionB.applyEncryptedChanges(_r16.envelopes);

    // Both devices edit the same message concurrently
    const envA = sessionA.change((d) => {
      d.messages.push({
        id: s("edit_a"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edit from A"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    const envB = sessionB.change((d) => {
      d.messages.push({
        id: s("edit_b"),
        channelId: s("ch_1"),
        systemId: s("sys_1"),
        senderId: s("mem_1"),
        content: s("Edit from B"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    const msgs = sessionA.document.messages;
    expect(msgs).toHaveLength(3);
    const editsOfMsg1 = msgs.filter((m) => m.editOf?.val === "msg_1");
    expect(editsOfMsg1).toHaveLength(2);
  });
});

// ── Sort order tie detection ──────────────────────────────────────────

describe("Sort order tie detection", () => {
  let relay: EncryptedRelay;
  let keys: DocumentKeys;

  beforeEach(() => {
    relay = new EncryptedRelay();
    keys = makeKeys(sodium);
  });

  it("concurrent reorders producing identical sortOrder values create detectable ties", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-sort-tie"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 1);
      d.groups[asGroupId("grp_2")] = makeGroup("grp_2", 2);
    });
    await relay.submit(seedEnv);
    const _r17 = await relay.getEnvelopesSince(asSyncDocId("doc-sort-tie"), 0);
    sessionB.applyEncryptedChanges(_r17.envelopes);

    // Both set the same sortOrder value
    const envA = sessionA.change((d) => {
      const g = d.groups[asGroupId("grp_1")];
      if (g) g.sortOrder = 5;
    });
    const envB = sessionB.change((d) => {
      const g = d.groups[asGroupId("grp_2")];
      if (g) g.sortOrder = 5;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    // Both groups have sortOrder 5 — a tie requiring post-merge normalization
    expect(sessionA.document.groups[asGroupId("grp_1")]?.sortOrder).toBe(5);
    expect(sessionA.document.groups[asGroupId("grp_2")]?.sortOrder).toBe(5);
  });

  it("three groups with concurrent reorders all converge", async () => {
    const base = createSystemCoreDocument();
    const [sessionA, sessionB] = makeSessions(base, keys, asSyncDocId("doc-sort-three"), sodium);

    const seedEnv = sessionA.change((d) => {
      d.groups[asGroupId("grp_1")] = makeGroup("grp_1", 1);
      d.groups[asGroupId("grp_2")] = makeGroup("grp_2", 2);
      d.groups[asGroupId("grp_3")] = makeGroup("grp_3", 3);
    });
    await relay.submit(seedEnv);
    const _r18 = await relay.getEnvelopesSince(asSyncDocId("doc-sort-three"), 0);
    sessionB.applyEncryptedChanges(_r18.envelopes);

    // A: reverse order
    const envA = sessionA.change((d) => {
      const g1 = d.groups[asGroupId("grp_1")];
      const g2 = d.groups[asGroupId("grp_2")];
      const g3 = d.groups[asGroupId("grp_3")];
      if (g1) g1.sortOrder = 3;
      if (g2) g2.sortOrder = 2;
      if (g3) g3.sortOrder = 1;
    });
    // B: all to same value
    const envB = sessionB.change((d) => {
      const g1 = d.groups[asGroupId("grp_1")];
      const g2 = d.groups[asGroupId("grp_2")];
      const g3 = d.groups[asGroupId("grp_3")];
      if (g1) g1.sortOrder = 10;
      if (g2) g2.sortOrder = 10;
      if (g3) g3.sortOrder = 10;
    });

    await relay.submit(envA);
    await relay.submit(envB);
    await syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document).toEqual(sessionB.document);
    // Each group has a sortOrder value — LWW picked winners
    for (const id of ["grp_1", "grp_2", "grp_3"]) {
      expect(typeof sessionA.document.groups[asGroupId(id)]?.sortOrder).toBe("number");
    }
  });
});
