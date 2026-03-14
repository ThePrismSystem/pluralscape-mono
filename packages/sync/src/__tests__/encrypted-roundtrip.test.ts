import * as Automerge from "@automerge/automerge";
import {
  configureSodium,
  createBucketKeyCache,
  deriveMasterKey,
  generateBucketKey,
  generateIdentityKeypair,
  generateSalt,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentKeyResolver } from "../document-key-resolver.js";
import { SignatureVerificationError } from "../encrypted-sync.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { BucketKeyCache, KdfMasterKey, SodiumAdapter, SignKeypair } from "@pluralscape/crypto";
import type { BucketId } from "@pluralscape/types";

interface MemberProfile {
  name: string;
  pronouns: string;
  description: string;
}

type DocSchema = { members: MemberProfile[] };

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  const salt = generateSalt();
  masterKey = await deriveMasterKey("integration-test-password", salt, "mobile");
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  bucketKeyCache.clearAll();
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

describe("encrypted roundtrip with real key hierarchy", () => {
  it("master-key roundtrip: sync changes between two sessions", () => {
    const resolver = DocumentKeyResolver.create({
      masterKey,
      signingKeys,
      bucketKeyCache,
      sodium,
    });

    try {
      const docId = "system-core-sys_rt1";
      const keys = resolver.resolveKeys(docId);
      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      const sessionA = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.members.push({ name: "Luna", pronouns: "she/her", description: "Host" });
      });
      relay.submit(envelope);

      sessionB.applyEncryptedChanges(relay.getEnvelopesSince(docId, 0));

      expect(sessionB.document.members).toHaveLength(1);
      expect(sessionB.document.members[0]?.name).toBe("Luna");
    } finally {
      resolver.dispose();
    }
  });

  it("bucket-key roundtrip: sync changes with per-bucket key", () => {
    const bucketId = "bkt_rt1" as BucketId;
    const bucketKey = generateBucketKey();
    bucketKeyCache.set(bucketId, bucketKey);

    const resolver = DocumentKeyResolver.create({
      masterKey,
      signingKeys,
      bucketKeyCache,
      sodium,
    });

    try {
      const docId = "bucket-bkt_rt1";
      const keys = resolver.resolveKeys(docId);
      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      const sessionA = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.members.push({ name: "Kai", pronouns: "they/them", description: "Protector" });
      });
      relay.submit(envelope);

      sessionB.applyEncryptedChanges(relay.getEnvelopesSince(docId, 0));

      expect(sessionB.document.members).toHaveLength(1);
      expect(sessionB.document.members[0]?.name).toBe("Kai");
    } finally {
      resolver.dispose();
    }
  });

  it("cross-key isolation: master-key change cannot be decrypted by bucket-key session", () => {
    const bucketId = "bkt_iso1" as BucketId;
    const bucketKey = generateBucketKey();
    bucketKeyCache.set(bucketId, bucketKey);

    const resolver = DocumentKeyResolver.create({
      masterKey,
      signingKeys,
      bucketKeyCache,
      sodium,
    });

    try {
      const masterDocId = "system-core-sys_iso";
      const bucketDocId = "bucket-bkt_iso1";
      const masterKeys = resolver.resolveKeys(masterDocId);
      const bucketKeys = resolver.resolveKeys(bucketDocId);
      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      // Create a change encrypted with master keys
      const masterSession = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys: masterKeys,
        documentId: masterDocId,
        sodium,
      });
      const envelope = masterSession.change((doc) => {
        doc.members.push({ name: "Secret", pronouns: "they/them", description: "hidden" });
      });

      // Submit to relay as if it were a bucket document
      relay.submit({ ...envelope, documentId: bucketDocId });
      const envelopes = relay.getEnvelopesSince(bucketDocId, 0);

      // Attempt to decrypt with bucket keys should fail
      const bucketSession = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys: bucketKeys,
        documentId: bucketDocId,
        sodium,
      });

      expect(() => {
        bucketSession.applyEncryptedChanges(envelopes);
      }).toThrow();
    } finally {
      resolver.dispose();
    }
  });

  it("snapshot roundtrip: create and load snapshot with real keys", () => {
    const resolver = DocumentKeyResolver.create({
      masterKey,
      signingKeys,
      bucketKeyCache,
      sodium,
    });

    try {
      const docId = "fronting-sys_snap";
      const keys = resolver.resolveKeys(docId);
      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      const sessionA = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      sessionA.change((doc) => {
        doc.members.push({ name: "Snapshotted", pronouns: "she/her", description: "Persisted" });
      });

      const snapshotEnvelope = sessionA.createSnapshot(1);
      relay.submitSnapshot(snapshotEnvelope);

      const loaded = relay.getLatestSnapshot(docId);
      expect(loaded).not.toBeNull();
      if (!loaded) return;

      const sessionB = EncryptedSyncSession.fromSnapshot<DocSchema>(loaded, keys, sodium);

      expect(sessionB.document.members).toHaveLength(1);
      expect(sessionB.document.members[0]?.name).toBe("Snapshotted");
    } finally {
      resolver.dispose();
    }
  });

  it("multi-device: two devices derive same master key and sync successfully", async () => {
    // Both devices use the same password + salt
    const sharedSalt = generateSalt();
    const password = "same-password-both-devices";
    const masterKey1 = await deriveMasterKey(password, sharedSalt, "mobile");
    const masterKey2 = await deriveMasterKey(password, sharedSalt, "mobile");

    // Verify deterministic derivation
    expect(new Uint8Array(masterKey1)).toEqual(new Uint8Array(masterKey2));

    const identity1 = generateIdentityKeypair(masterKey1);
    const identity2 = generateIdentityKeypair(masterKey2);
    const cache1 = createBucketKeyCache();
    const cache2 = createBucketKeyCache();

    const resolver1 = DocumentKeyResolver.create({
      masterKey: masterKey1,
      signingKeys: identity1.signing,
      bucketKeyCache: cache1,
      sodium,
    });
    const resolver2 = DocumentKeyResolver.create({
      masterKey: masterKey2,
      signingKeys: identity2.signing,
      bucketKeyCache: cache2,
      sodium,
    });

    try {
      const docId = "journal-sys_multi";
      const keys1 = resolver1.resolveKeys(docId);
      const keys2 = resolver2.resolveKeys(docId);

      // Encryption keys should be identical (same master key, same KDF)
      expect(new Uint8Array(keys1.encryptionKey)).toEqual(new Uint8Array(keys2.encryptionKey));

      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      // Device 1 creates a change
      const session1 = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys: keys1,
        documentId: docId,
        sodium,
      });
      const envelope = session1.change((doc) => {
        doc.members.push({ name: "From Device 1", pronouns: "they/them", description: "synced" });
      });
      relay.submit(envelope);

      // Device 2 syncs the change (using its own independently-derived keys)
      const session2 = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys: keys2,
        documentId: docId,
        sodium,
      });
      session2.applyEncryptedChanges(relay.getEnvelopesSince(docId, 0));

      expect(session2.document.members).toHaveLength(1);
      expect(session2.document.members[0]?.name).toBe("From Device 1");
    } finally {
      resolver1.dispose();
      resolver2.dispose();
      cache1.clearAll();
      cache2.clearAll();
      sodium.memzero(masterKey1);
      sodium.memzero(masterKey2);
    }
  });

  it("rejects tampered ciphertext through full resolver-to-session pipeline", () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "system-core-sys_tamper";
      const keys = resolver.resolveKeys(docId);
      const base = Automerge.from<DocSchema>({ members: [] });
      const relay = new EncryptedRelay();

      const sessionA = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const envelope = sessionA.change((doc) => {
        doc.members.push({ name: "Tamper Test", pronouns: "they/them", description: "integrity" });
      });

      // Tamper with ciphertext before relay
      const tampered = new Uint8Array(envelope.ciphertext);
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      relay.submit({ ...envelope, ciphertext: tampered });

      // Session B should reject the tampered envelope
      const sessionB = new EncryptedSyncSession({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      expect(() => {
        sessionB.applyEncryptedChanges(relay.getEnvelopesSince(docId, 0));
      }).toThrow(SignatureVerificationError);
    } finally {
      resolver.dispose();
    }
  });
});
