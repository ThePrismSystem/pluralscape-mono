/**
 * Typed encrypted roundtrip tests.
 *
 * Verifies that real Automerge document schemas (SystemCoreDocument,
 * FrontingDocument, ChatDocument) work correctly through the full pipeline:
 *   change() → encrypt → relay → decrypt → applyEncryptedChanges()
 *
 * These tests bridge the document schema layer (sync-y3ps) with the existing
 * encrypted sync infrastructure (sync-pl87).
 *
 * Key constraint: both sessions MUST start from the same base document
 * (via Automerge.clone). Independently created documents are separate CRDT
 * objects — changes from one are not applicable to the other.
 */
import * as Automerge from "@automerge/automerge";
import {
  configureSodium,
  createBucketKeyCache,
  deriveMasterKey,
  generateIdentityKeypair,
  generateSalt,
  initSodium,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentKeyResolver } from "../document-key-resolver.js";
import {
  createChatDocument,
  createFrontingDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedRelay } from "../relay.js";
import { EncryptedSyncSession } from "../sync-session.js";

import type { ChatDocument } from "../schemas/chat.js";
import type { FrontingDocument } from "../schemas/fronting.js";
import type { SystemCoreDocument } from "../schemas/system-core.js";
import type { BucketKeyCache, KdfMasterKey, SodiumAdapter, SignKeypair } from "@pluralscape/crypto";

const s = (v: string): Automerge.ImmutableString => new Automerge.ImmutableString(v);

let sodium: SodiumAdapter;
let masterKey: KdfMasterKey;
let signingKeys: SignKeypair;
let bucketKeyCache: BucketKeyCache;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  configureSodium(sodium);
  await initSodium();

  const salt = generateSalt();
  masterKey = await deriveMasterKey("typed-roundtrip-test-pass", salt, "mobile");
  const identity = generateIdentityKeypair(masterKey);
  signingKeys = identity.signing;
  bucketKeyCache = createBucketKeyCache();
});

afterAll(() => {
  bucketKeyCache.clearAll();
  sodium.memzero(signingKeys.secretKey);
  sodium.memzero(masterKey);
});

describe("typed encrypted roundtrip — SystemCoreDocument", () => {
  it("syncs a new member entry between two sessions", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "system-core-sys_typed1";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createSystemCoreDocument();

      const sessionA = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.members["mem_1"] = {
          id: s("mem_1"),
          systemId: s("sys_typed1"),
          name: s("Luna"),
          pronouns: s("[]"),
          description: null,
          avatarSource: null,
          colors: s("[]"),
          saturationLevel: s("normal"),
          tags: s("[]"),
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        };
      });
      await relay.submit(envelope);

      const _r1 = await relay.getEnvelopesSince(docId, 0);
      sessionB.applyEncryptedChanges(_r1.envelopes);

      expect(sessionB.document.members["mem_1"]).toBeDefined();
      expect(String(sessionB.document.members["mem_1"]?.name)).toBe("Luna");
    } finally {
      resolver.dispose();
    }
  });

  it("merges concurrent member additions without data loss", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "system-core-sys_typed2";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createSystemCoreDocument();

      const sessionA = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const sharedMemberBase = {
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s("normal"),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const envA = sessionA.change((doc) => {
        doc.members["mem_a"] = {
          id: s("mem_a"),
          systemId: s("sys_typed2"),
          name: s("Kai"),
          ...sharedMemberBase,
        };
      });
      const envB = sessionB.change((doc) => {
        doc.members["mem_b"] = {
          id: s("mem_b"),
          systemId: s("sys_typed2"),
          name: s("River"),
          ...sharedMemberBase,
          createdAt: 1001,
          updatedAt: 1001,
        };
      });

      await relay.submit(envA);
      await relay.submit(envB);

      const sessionC = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const _r2 = await relay.getEnvelopesSince(docId, 0);
      sessionC.applyEncryptedChanges(_r2.envelopes);

      expect(sessionC.document.members["mem_a"]).toBeDefined();
      expect(sessionC.document.members["mem_b"]).toBeDefined();
      expect(String(sessionC.document.members["mem_a"]?.name)).toBe("Kai");
      expect(String(sessionC.document.members["mem_b"]?.name)).toBe("River");
    } finally {
      resolver.dispose();
    }
  });

  it("syncs group membership junctions", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "system-core-sys_typed3";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createSystemCoreDocument();

      const sessionA = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<SystemCoreDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        // junction key: {groupId}_{memberId}
        doc.groupMemberships["grp_a_mem_1"] = true;
        doc.groupMemberships["grp_a_mem_2"] = true;
      });
      await relay.submit(envelope);

      const _r3 = await relay.getEnvelopesSince(docId, 0);
      sessionB.applyEncryptedChanges(_r3.envelopes);

      expect(sessionB.document.groupMemberships["grp_a_mem_1"]).toBe(true);
      expect(sessionB.document.groupMemberships["grp_a_mem_2"]).toBe(true);
      expect(Object.keys(sessionB.document.groupMemberships)).toHaveLength(2);
    } finally {
      resolver.dispose();
    }
  });

  it("survives snapshot roundtrip with real system-core schema", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "system-core-sys_typed_snap";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();

      const sessionA = new EncryptedSyncSession<SystemCoreDocument>({
        doc: createSystemCoreDocument(),
        keys,
        documentId: docId,
        sodium,
      });

      sessionA.change((doc) => {
        doc.system.name = s("Test System");
        doc.system.id = s("sys_typed_snap");
      });

      const snapshot = sessionA.createSnapshot(1);
      await relay.submitSnapshot(snapshot);

      const loaded = await relay.getLatestSnapshot(docId);
      expect(loaded).not.toBeNull();
      if (!loaded) return;

      const sessionB = EncryptedSyncSession.fromSnapshot<SystemCoreDocument>(loaded, keys, sodium);
      expect(String(sessionB.document.system.name)).toBe("Test System");
    } finally {
      resolver.dispose();
    }
  });
});

describe("typed encrypted roundtrip — FrontingDocument", () => {
  it("syncs a fronting session entry between two sessions", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "fronting-sys_typed1";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createFrontingDocument();

      const sessionA = new EncryptedSyncSession<FrontingDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<FrontingDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.sessions["fs_1"] = {
          id: s("fs_1"),
          systemId: s("sys_typed1"),
          memberId: s("mem_1"),
          startTime: 1000,
          endTime: null,
          frontingType: s("fronting"),
          comment: null,
          customFrontId: null,
          linkedStructure: null,
          positionality: null,
          outtrigger: null,
          archived: false,
          createdAt: 1000,
          updatedAt: 1000,
        };
      });
      await relay.submit(envelope);

      const _r4 = await relay.getEnvelopesSince(docId, 0);
      sessionB.applyEncryptedChanges(_r4.envelopes);

      expect(sessionB.document.sessions["fs_1"]).toBeDefined();
      expect(String(sessionB.document.sessions["fs_1"]?.memberId)).toBe("mem_1");
    } finally {
      resolver.dispose();
    }
  });

  it("syncs switch append-only entries", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "fronting-sys_typed2";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createFrontingDocument();

      const sessionA = new EncryptedSyncSession<FrontingDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<FrontingDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.switches.push({
          id: s("sw_1"),
          systemId: s("sys_typed2"),
          memberIds: s('["mem_1"]'),
          timestamp: 1000,
          archived: false,
        });
      });
      await relay.submit(envelope);

      const _r5 = await relay.getEnvelopesSince(docId, 0);
      sessionB.applyEncryptedChanges(_r5.envelopes);

      expect(sessionB.document.switches).toHaveLength(1);
      expect(String(sessionB.document.switches[0]?.memberIds)).toBe('["mem_1"]');
    } finally {
      resolver.dispose();
    }
  });
});

describe("typed encrypted roundtrip — ChatDocument", () => {
  it("syncs message appends between two sessions", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "chat-ch_typed1";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createChatDocument();

      const sessionA = new EncryptedSyncSession<ChatDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<ChatDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const envelope = sessionA.change((doc) => {
        doc.messages.push({
          id: s("msg_1"),
          channelId: s("ch_typed1"),
          systemId: s("sys_typed1"),
          senderId: s("mem_1"),
          content: s("Hello, world!"),
          attachments: s("[]"),
          mentions: s("[]"),
          replyToId: null,
          editOf: null,
          timestamp: 1000,
          archived: false,
        });
      });
      await relay.submit(envelope);

      const _r6 = await relay.getEnvelopesSince(docId, 0);
      sessionB.applyEncryptedChanges(_r6.envelopes);

      expect(sessionB.document.messages).toHaveLength(1);
      expect(String(sessionB.document.messages[0]?.content)).toBe("Hello, world!");
    } finally {
      resolver.dispose();
    }
  });

  it("merges concurrent message appends (both messages present)", async () => {
    const resolver = DocumentKeyResolver.create({ masterKey, signingKeys, bucketKeyCache, sodium });
    try {
      const docId = "chat-ch_typed2";
      const keys = resolver.resolveKeys(docId);
      const relay = new EncryptedRelay();
      const base = createChatDocument();

      const sessionA = new EncryptedSyncSession<ChatDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const sessionB = new EncryptedSyncSession<ChatDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });

      const msgBase = {
        channelId: s("ch_typed2"),
        systemId: s("sys_typed2"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        editOf: null,
        archived: false,
      };

      const envA = sessionA.change((doc) => {
        doc.messages.push({
          id: s("msg_a"),
          senderId: s("mem_a"),
          content: s("From A"),
          timestamp: 1000,
          ...msgBase,
        });
      });
      const envB = sessionB.change((doc) => {
        doc.messages.push({
          id: s("msg_b"),
          senderId: s("mem_b"),
          content: s("From B"),
          timestamp: 1001,
          ...msgBase,
        });
      });

      await relay.submit(envA);
      await relay.submit(envB);

      const sessionC = new EncryptedSyncSession<ChatDocument>({
        doc: Automerge.clone(base),
        keys,
        documentId: docId,
        sodium,
      });
      const _r7 = await relay.getEnvelopesSince(docId, 0);
      sessionC.applyEncryptedChanges(_r7.envelopes);

      expect(sessionC.document.messages).toHaveLength(2);
      const ids = sessionC.document.messages.map((m) => String(m.id));
      expect(ids).toContain("msg_a");
      expect(ids).toContain("msg_b");
    } finally {
      resolver.dispose();
    }
  });
});
