import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession, syncThroughRelay } from "../sync-session.js";

import type { DocumentKeys, MemberProfile } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

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

  it("3.6 — applying the same encrypted change twice is idempotent", () => {
    const sessionA = makeSession(base, sharedKeys);
    const sessionB = makeSession(base, sharedKeys);

    sessionA.change((doc) => {
      doc.members.push({ name: "Duplicate", pronouns: "they/them", description: "test" });
    });

    const rawChange = Automerge.getLastLocalChange(sessionA.document);
    expect(rawChange).toBeDefined();
    if (!rawChange) return;

    const [afterFirst] = Automerge.applyChanges(sessionB.document, [rawChange]);
    expect(afterFirst.members).toHaveLength(1);

    const [afterSecond] = Automerge.applyChanges(afterFirst, [rawChange]);
    expect(afterSecond.members).toHaveLength(1);
    expect(afterSecond.members[0]?.name).toBe("Duplicate");
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
});
