import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

interface MemberProfile {
  name: string;
  pronouns: string;
  description: string;
}

type DocSchema = { members: MemberProfile[] };

let sodium: SodiumAdapter;
const DOCUMENT_ID = "doc-sync-001";

function makeKeys(s: SodiumAdapter): DocumentKeys {
  return {
    encryptionKey: s.aeadKeygen(),
    signingKeys: s.signKeypair(),
  };
}

function makeSession(
  base: Automerge.Doc<DocSchema>,
  keys: DocumentKeys,
): EncryptedSyncSession<DocSchema> {
  return new EncryptedSyncSession({
    doc: Automerge.clone(base),
    keys,
    documentId: DOCUMENT_ID,
    sodium,
  });
}

/** Access first member in an Automerge change callback, throwing if absent. */
function firstMember(doc: DocSchema): MemberProfile {
  const member = doc.members[0];
  if (!member) {
    throw new Error("Expected at least one member");
  }
  return member;
}

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

describe("EncryptedSyncSession — full integration", () => {
  let relay: EncryptedRelay;
  let sharedKeys: DocumentKeys;
  let base: Automerge.Doc<DocSchema>;

  beforeEach(() => {
    relay = new EncryptedRelay();
    sharedKeys = makeKeys(sodium);
    base = Automerge.from<DocSchema>({ members: [] });
  });

  it("3.1 — two sessions sync a MemberProfile through encrypted relay", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    const envelope = sessionA.change((doc) => {
      doc.members.push({ name: "Luna", pronouns: "she/her", description: "Host" });
    });
    relay.submit(envelope);

    sessionB.applyEncryptedChanges(relay.getEnvelopesSince(DOCUMENT_ID, 0));

    expect(sessionB.document.members).toHaveLength(1);
    expect(sessionB.document.members[0]?.name).toBe("Luna");
  });

  it("3.2 — changes on one side propagate through encrypted relay", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    relay.submit(
      sessionA.change((doc) => {
        doc.members.push({ name: "Kai", pronouns: "they/them", description: "Protector" });
      }),
    );
    relay.submit(
      sessionA.change((doc) => {
        doc.members.push({ name: "Nova", pronouns: "xe/xem", description: "Little" });
      }),
    );

    sessionB.applyEncryptedChanges(relay.getEnvelopesSince(DOCUMENT_ID, 0));

    expect(sessionB.document.members).toHaveLength(2);
    expect(sessionB.document.members[0]?.name).toBe("Kai");
    expect(sessionB.document.members[1]?.name).toBe("Nova");
  });

  it("3.3 — concurrent edits to different fields merge without conflict", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    relay.submit(
      sessionA.change((doc) => {
        doc.members.push({ name: "Original", pronouns: "they/them", description: "none" });
      }),
    );
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince(DOCUMENT_ID, 0));

    const envelopeA = sessionA.change((doc) => {
      firstMember(doc).name = "Updated Name";
    });
    const envelopeB = sessionB.change((doc) => {
      firstMember(doc).pronouns = "she/her";
    });

    relay.submit(envelopeA);
    relay.submit(envelopeB);
    syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members[0]?.name).toBe("Updated Name");
    expect(sessionA.document.members[0]?.pronouns).toBe("she/her");
    expect(sessionA.document).toEqual(sessionB.document);
  });

  it("3.4 — concurrent edits to same field produce deterministic LWW resolution", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    relay.submit(
      sessionA.change((doc) => {
        doc.members.push({ name: "Original", pronouns: "they/them", description: "none" });
      }),
    );
    sessionB.applyEncryptedChanges(relay.getEnvelopesSince(DOCUMENT_ID, 0));

    const envelopeA = sessionA.change((doc) => {
      firstMember(doc).name = "Name A";
    });
    const envelopeB = sessionB.change((doc) => {
      firstMember(doc).name = "Name B";
    });

    relay.submit(envelopeA);
    relay.submit(envelopeB);
    syncThroughRelay([sessionA, sessionB], relay);

    expect(sessionA.document.members[0]?.name).toBe(sessionB.document.members[0]?.name);
  });

  it("3.5 — concurrent edits resolve identically regardless of apply order", () => {
    const keysForTest = makeKeys(sodium);
    const relayFwd = new EncryptedRelay();
    const relayRev = new EncryptedRelay();

    const sessionA1 = makeSession(base, keysForTest);
    const sessionB1 = makeSession(base, keysForTest);
    const sessionA2 = makeSession(base, keysForTest);
    const sessionB2 = makeSession(base, keysForTest);

    const initEnvelope = sessionA1.change((doc) => {
      doc.members.push({ name: "Original", pronouns: "they/them", description: "none" });
    });
    for (const r of [relayFwd, relayRev]) {
      r.submit(initEnvelope);
    }
    for (const s of [sessionB1, sessionA2, sessionB2]) {
      s.applyEncryptedChanges(relayFwd.getEnvelopesSince(DOCUMENT_ID, 0));
    }

    const envA = sessionA1.change((doc) => {
      firstMember(doc).name = "From A";
    });
    const envB = sessionB1.change((doc) => {
      firstMember(doc).name = "From B";
    });

    relayFwd.submit(envA);
    relayFwd.submit(envB);
    syncThroughRelay([sessionA1, sessionB1], relayFwd);

    relayRev.submit(envB);
    relayRev.submit(envA);
    syncThroughRelay([sessionA2, sessionB2], relayRev);

    expect(sessionA1.document.members[0]?.name).toBe(sessionA2.document.members[0]?.name);
  });

  it("3.6 — applying the same encrypted envelopes twice is idempotent via seq-skip", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    const envelope = sessionA.change((doc) => {
      doc.members.push({ name: "Duplicate", pronouns: "they/them", description: "test" });
    });
    const seq = relay.submit(envelope);

    const envelopes = relay.getEnvelopesSince(DOCUMENT_ID, 0);
    sessionB.applyEncryptedChanges(envelopes);
    expect(sessionB.document.members).toHaveLength(1);
    expect(sessionB.lastSyncedSeq).toBe(seq);

    // Apply same envelopes again — should be idempotent
    sessionB.applyEncryptedChanges(envelopes);
    expect(sessionB.document.members).toHaveLength(1);
    expect(sessionB.document.members[0]?.name).toBe("Duplicate");
    expect(sessionB.lastSyncedSeq).toBe(seq);
  });

  it("3.7 — snapshot roundtrip preserves document state through encryption", () => {
    const sessionA = makeSession(base, sharedKeys);

    sessionA.change((doc) => {
      doc.members.push({ name: "Snapshotted", pronouns: "she/her", description: "Persisted" });
    });

    const snapshotEnvelope = sessionA.createSnapshot(1);
    relay.submitSnapshot(snapshotEnvelope);

    const loaded = relay.getLatestSnapshot(DOCUMENT_ID);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    const sessionB = EncryptedSyncSession.fromSnapshot<DocSchema>(loaded, sharedKeys, sodium);

    expect(sessionB.document.members).toHaveLength(1);
    expect(sessionB.document.members[0]?.name).toBe("Snapshotted");
  });

  it("3.8 — sync continues correctly after loading from snapshot", () => {
    const sessionA = makeSession(base, sharedKeys);

    sessionA.change((doc) => {
      doc.members.push({ name: "Before Snapshot", pronouns: "they/them", description: "v1" });
    });

    const snapshotEnvelope = sessionA.createSnapshot(1);
    relay.submitSnapshot(snapshotEnvelope);

    const snapshot = relay.getLatestSnapshot(DOCUMENT_ID);
    expect(snapshot).not.toBeNull();
    if (!snapshot) return;

    const sessionB = EncryptedSyncSession.fromSnapshot<DocSchema>(snapshot, sharedKeys, sodium);

    relay.submit(
      sessionA.change((doc) => {
        doc.members.push({ name: "After Snapshot", pronouns: "she/her", description: "v2" });
      }),
    );

    sessionB.applyEncryptedChanges(relay.getEnvelopesSince(DOCUMENT_ID, 0));

    expect(sessionB.document.members).toHaveLength(2);
    expect(sessionB.document.members[1]?.name).toBe("After Snapshot");
  });

  it("3.9 — three-way concurrent edit resolves deterministically", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);
    const sessionC = makeSession(base, sharedKeys);

    const initEnv = sessionA.change((doc) => {
      doc.members.push({ name: "Original", pronouns: "they/them", description: "none" });
    });
    relay.submit(initEnv);
    const initEnvelopes = relay.getEnvelopesSince(DOCUMENT_ID, 0);
    sessionB.applyEncryptedChanges(initEnvelopes);
    sessionC.applyEncryptedChanges(initEnvelopes);

    const envA = sessionA.change((doc) => {
      firstMember(doc).description = "From A";
    });
    const envB = sessionB.change((doc) => {
      firstMember(doc).description = "From B";
    });
    const envC = sessionC.change((doc) => {
      firstMember(doc).description = "From C";
    });

    relay.submit(envA);
    relay.submit(envB);
    relay.submit(envC);
    syncThroughRelay([sessionA, sessionB, sessionC], relay);

    const resultA = sessionA.document.members[0]?.description;
    const resultB = sessionB.document.members[0]?.description;
    const resultC = sessionC.document.members[0]?.description;

    expect(resultA).toBe(resultB);
    expect(resultB).toBe(resultC);
  });

  it("3.10 — mid-batch decryption failure rolls back doc and lastSyncedSeq", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    // First envelope: valid
    const env1 = sessionA.change((doc) => {
      doc.members.push({ name: "Valid", pronouns: "they/them", description: "ok" });
    });
    const seq1 = relay.submit(env1);

    // Second envelope: corrupted ciphertext (will fail signature check)
    const env2 = sessionA.change((doc) => {
      firstMember(doc).name = "Updated";
    });
    const seq2 = relay.submit(env2);

    const envelopes = relay.getEnvelopesSince(DOCUMENT_ID, 0);
    // Corrupt the second envelope's ciphertext
    const corrupted = envelopes.map((e) => {
      if (e.seq === seq2) {
        const badCiphertext = new Uint8Array(e.ciphertext);
        badCiphertext[0] = (badCiphertext[0] ?? 0) ^ 0xff;
        return { ...e, ciphertext: badCiphertext };
      }
      return e;
    });

    // Apply first envelope successfully
    sessionB.applyEncryptedChanges(envelopes.filter((e) => e.seq === seq1));
    expect(sessionB.document.members).toHaveLength(1);
    expect(sessionB.lastSyncedSeq).toBe(seq1);

    // Now try to apply the full batch starting from seq 0 (includes corrupted)
    // But since seq1 is already applied, it will skip it and fail on seq2
    const docBefore = sessionB.document;
    const seqBefore = sessionB.lastSyncedSeq;

    expect(() => {
      sessionB.applyEncryptedChanges(corrupted);
    }).toThrow();

    // Doc and seq should be rolled back to pre-batch state
    expect(sessionB.document).toBe(docBefore);
    expect(sessionB.lastSyncedSeq).toBe(seqBefore);
  });

  it("3.11 — relay rejects snapshot version downgrade or equal version", () => {
    const sessionA = makeSession(base, sharedKeys);

    sessionA.change((doc) => {
      doc.members.push({ name: "Snap", pronouns: "they/them", description: "v2" });
    });

    const snapshotV2 = sessionA.createSnapshot(2);
    relay.submitSnapshot(snapshotV2);

    // Attempt to submit version 1 (downgrade)
    const snapshotV1 = sessionA.createSnapshot(1);
    expect(() => {
      relay.submitSnapshot(snapshotV1);
    }).toThrow(/not newer than current version/);

    // Attempt to submit same version 2 (equal)
    const snapshotV2Again = sessionA.createSnapshot(2);
    expect(() => {
      relay.submitSnapshot(snapshotV2Again);
    }).toThrow(/not newer than current version/);

    // Version 3 should succeed
    const snapshotV3 = sessionA.createSnapshot(3);
    expect(() => {
      relay.submitSnapshot(snapshotV3);
    }).not.toThrow();
  });

  describe("M22 — sort skip for trivial arrays", () => {
    it("applies empty envelope array without error", () => {
      const session = makeSession(base, sharedKeys);
      session.applyEncryptedChanges([]);
      expect(session.lastSyncedSeq).toBe(0);
    });

    it("applies single envelope without copying/sorting", () => {
      const sessionA = makeSession(base, sharedKeys);
      const sessionB = makeSession(base, sharedKeys);

      const envelope = sessionA.change((doc) => {
        doc.members.push({ name: "SingleChange", pronouns: "they/them", description: "test" });
      });
      const seq = relay.submit(envelope);
      const envelopes = relay.getEnvelopesSince(DOCUMENT_ID, 0);

      expect(envelopes).toHaveLength(1);
      sessionB.applyEncryptedChanges(envelopes);
      expect(sessionB.lastSyncedSeq).toBe(seq);
      expect(sessionB.document.members).toHaveLength(1);
    });

    it("correctly sorts multiple out-of-order envelopes", () => {
      const sessionA = makeSession(base, sharedKeys);
      const sessionB = makeSession(base, sharedKeys);

      const env1 = sessionA.change((doc) => {
        doc.members.push({ name: "First", pronouns: "they/them", description: "1" });
      });
      relay.submit(env1);

      const env2 = sessionA.change((doc) => {
        doc.members.push({ name: "Second", pronouns: "they/them", description: "2" });
      });
      relay.submit(env2);

      const envelopes = relay.getEnvelopesSince(DOCUMENT_ID, 0);
      // Reverse to simulate out-of-order delivery
      const reversed = [...envelopes].reverse();
      sessionB.applyEncryptedChanges(reversed);

      expect(sessionB.document.members).toHaveLength(2);
      expect(sessionB.document.members[0]?.name).toBe("First");
      expect(sessionB.document.members[1]?.name).toBe("Second");
    });
  });
});
