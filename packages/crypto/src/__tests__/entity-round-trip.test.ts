/**
 * Entity encryption round-trip tests.
 *
 * These tests verify that the blob-codec + real crypto pipeline works
 * end-to-end for each entity type. Each test serializes an entity's
 * encrypted fields as JSON, encrypts with XChaCha20-Poly1305, runs the
 * blob through serialize/deserialize, then decrypts and verifies the
 * original payload is recovered intact.
 */

import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { deserializeEncryptedBlob, serializeEncryptedBlob } from "../blob-codec.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { BucketId, T1EncryptedBlob, T2EncryptedBlob } from "@pluralscape/types";

let adapter: SodiumAdapter;

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

/** Encrypt fields as T1, serialize → deserialize → decrypt, assert equality. */
function t1RoundTrip(fields: Record<string, unknown>): void {
  const plaintext = new TextEncoder().encode(JSON.stringify(fields));
  const key = adapter.aeadKeygen();
  const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
  const blob: T1EncryptedBlob = {
    ciphertext,
    nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
  const serialized = serializeEncryptedBlob(blob);
  const deserialized = deserializeEncryptedBlob(serialized);
  const decrypted = adapter.aeadDecrypt(deserialized.ciphertext, nonce, null, key);
  const result = JSON.parse(new TextDecoder().decode(decrypted));
  expect(result).toEqual(fields);
  expect(deserialized.tier).toBe(1);
  expect(deserialized.keyVersion).toBeNull();
  expect(deserialized.bucketId).toBeNull();
}

describe("entity encryption round-trip", () => {
  it("blob-codec + real AEAD encrypt/decrypt round-trips end-to-end", () => {
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ name: "Test Member", pronouns: "they/them" }),
    );
    const key = adapter.aeadKeygen();

    // Encrypt (aeadEncrypt generates a random nonce internally)
    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);

    // Package as T1EncryptedBlob
    const blob: T1EncryptedBlob = {
      ciphertext,
      nonce,
      tier: 1,
      algorithm: "xchacha20-poly1305",
      keyVersion: null,
      bucketId: null,
    };

    // Serialize → deserialize (simulates DB round-trip)
    const serialized = serializeEncryptedBlob(blob);
    const deserialized = deserializeEncryptedBlob(serialized);

    // Decrypt
    // Use the original branded nonce for decryption — deserialized.nonce is Uint8Array
    // which matches byte-for-byte but aeadDecrypt expects the branded AeadNonce type
    const decrypted = adapter.aeadDecrypt(deserialized.ciphertext, nonce, null, key);
    const result = JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, string>;

    expect(result).toEqual({ name: "Test Member", pronouns: "they/them" });
    expect(deserialized.tier).toBe(1);
    expect(deserialized.keyVersion).toBeNull();
    expect(deserialized.bucketId).toBeNull();
  });

  // ── T1 entity-type round-trip tests ──────────────────────────────

  describe("Member round-trip", () => {
    it("round-trips Member encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Test Member",
        pronouns: "they/them",
        description: "A test member",
        tags: ["tag1"],
        colors: { primary: "#ff0000" },
        avatarSource: null,
        saturationLevel: "highly-elaborated",
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: true,
      });
    });
  });

  describe("FrontingSession round-trip", () => {
    it("round-trips FrontingSession encrypted fields end-to-end", () => {
      t1RoundTrip({ comment: "feeling good", positionality: "close" });
    });
  });

  describe("FrontingComment round-trip", () => {
    it("round-trips FrontingComment encrypted fields end-to-end", () => {
      t1RoundTrip({ content: "This is a fronting comment" });
    });
  });

  describe("Group round-trip", () => {
    it("round-trips Group encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Test Group",
        description: "A group",
        imageSource: null,
        color: "#00ff00",
        emoji: null,
      });
    });
  });

  describe("Channel round-trip", () => {
    it("round-trips Channel encrypted fields end-to-end", () => {
      t1RoundTrip({ name: "general" });
    });
  });

  describe("ChatMessage round-trip", () => {
    it("round-trips ChatMessage encrypted fields end-to-end", () => {
      t1RoundTrip({
        content: "Hello everyone",
        attachments: [],
        mentions: [],
        senderId: "mem_abc",
      });
    });
  });

  describe("BoardMessage round-trip", () => {
    it("round-trips BoardMessage encrypted fields end-to-end", () => {
      t1RoundTrip({ content: "Announcement", senderId: "mem_abc" });
    });
  });

  describe("Note round-trip", () => {
    it("round-trips Note encrypted fields end-to-end", () => {
      t1RoundTrip({ title: "My Note", content: "Note body", backgroundColor: "#ffffcc" });
    });
  });

  describe("JournalEntry round-trip", () => {
    it("round-trips JournalEntry encrypted fields end-to-end", () => {
      t1RoundTrip({
        title: "Today",
        blocks: [],
        tags: ["daily"],
        linkedEntities: [],
        author: "mem_abc",
      });
    });
  });

  describe("InnerWorldEntity round-trip", () => {
    it("round-trips InnerWorldEntity encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Castle",
        description: "A castle in the inner world",
        visual: null,
        entityType: "landmark",
        positionX: 100,
        positionY: 200,
      });
    });
  });

  describe("InnerWorldRegion round-trip", () => {
    it("round-trips InnerWorldRegion encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Forest",
        description: "Dense forest",
        boundaryData: null,
        visual: null,
        gatekeeperMemberIds: [],
        accessType: "open",
      });
    });
  });

  describe("CustomFront round-trip", () => {
    it("round-trips CustomFront encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Dissociated",
        description: "Feeling disconnected",
        color: "#808080",
        emoji: null,
      });
    });
  });

  describe("AcknowledgementRequest round-trip", () => {
    it("round-trips AcknowledgementRequest encrypted fields end-to-end", () => {
      t1RoundTrip({
        message: "Please confirm",
        targetMemberId: "mem_target",
        confirmedAt: 1700000000000,
      });
    });
  });

  describe("Subsystem round-trip", () => {
    it("round-trips Subsystem encrypted fields end-to-end", () => {
      t1RoundTrip({ name: "The Littles", description: "Our younger headmates" });
    });
  });

  describe("SideSystem round-trip", () => {
    it("round-trips SideSystem encrypted fields end-to-end", () => {
      t1RoundTrip({ name: "External Side", description: "A connected side system" });
    });
  });

  describe("Layer round-trip", () => {
    it("round-trips Layer encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Inner Layer",
        description: "Deep protected space",
        accessType: "gatekept",
      });
    });
  });

  describe("Relationship round-trip", () => {
    it("round-trips Relationship encrypted fields end-to-end", () => {
      t1RoundTrip({ label: "protects" });
    });
  });

  describe("FieldDefinition round-trip", () => {
    it("round-trips FieldDefinition encrypted fields end-to-end", () => {
      t1RoundTrip({
        name: "Pronouns",
        description: "Preferred pronouns",
        options: ["he/him", "she/her", "they/them"],
      });
    });
  });

  describe("FieldValue round-trip", () => {
    it("round-trips FieldValue encrypted fields end-to-end", () => {
      t1RoundTrip({ value: "they/them" });
    });
  });

  describe("LifecycleEvent round-trip", () => {
    it("round-trips LifecycleEvent encrypted fields end-to-end", () => {
      t1RoundTrip({ notes: "Formed during early childhood" });
    });
  });

  describe("WikiPage round-trip", () => {
    it("round-trips WikiPage encrypted fields end-to-end", () => {
      t1RoundTrip({
        title: "System History",
        slug: "system-history",
        blocks: [],
        tags: ["lore"],
        linkedEntities: [],
        linkedFromPages: [],
      });
    });
  });

  describe("MemberPhoto round-trip", () => {
    it("round-trips MemberPhoto encrypted fields end-to-end", () => {
      t1RoundTrip({ imageSource: "blob:photo-001", caption: "Recent photo" });
    });
  });

  describe("Poll round-trip", () => {
    it("round-trips Poll encrypted fields end-to-end", () => {
      t1RoundTrip({
        title: "Dinner plans?",
        options: ["pizza", "tacos"],
        description: "Vote for tonight",
      });
    });
  });

  describe("PollVote round-trip", () => {
    it("round-trips PollVote encrypted fields end-to-end", () => {
      t1RoundTrip({ comment: "I prefer tacos" });
    });
  });

  describe("TimerConfig round-trip", () => {
    it("round-trips TimerConfig encrypted fields end-to-end", () => {
      t1RoundTrip({ promptText: "Who is fronting?" });
    });
  });

  describe("AuditLogEntry round-trip", () => {
    it("round-trips AuditLogEntry encrypted fields end-to-end", () => {
      t1RoundTrip({ detail: "Member name updated" });
    });
  });
});

// ── T2 bucket-encrypted round-trip ────────────────────────────────

describe("T2 bucket-encrypted round-trip", () => {
  it("round-trips with bucketId and keyVersion", () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ name: "Bucket Member" }));
    const key = adapter.aeadKeygen();
    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);
    const blob: T2EncryptedBlob = {
      ciphertext,
      nonce,
      tier: 2,
      algorithm: "xchacha20-poly1305",
      keyVersion: 1,
      bucketId: brandId<BucketId>("bkt_test"),
    };
    const serialized = serializeEncryptedBlob(blob);
    const deserialized = deserializeEncryptedBlob(serialized);
    const decrypted = adapter.aeadDecrypt(deserialized.ciphertext, nonce, null, key);
    const result = JSON.parse(new TextDecoder().decode(decrypted));
    expect(result).toEqual({ name: "Bucket Member" });
    expect(deserialized.tier).toBe(2);
    expect(deserialized.bucketId).toBe("bkt_test");
    expect(deserialized.keyVersion).toBe(1);
  });
});

// ── Crypto failure modes ──────────────────────────────────────────

describe("crypto failure modes", () => {
  it("throws when decrypting with wrong key", () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ name: "secret" }));
    const keyA = adapter.aeadKeygen();
    const keyB = adapter.aeadKeygen();

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, keyA);

    expect(() => adapter.aeadDecrypt(ciphertext, nonce, null, keyB)).toThrow();
  });

  it("throws when AD mismatches between encrypt and decrypt", () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ name: "secret" }));
    const key = adapter.aeadKeygen();
    const adEncrypt = new Uint8Array([1, 2, 3]);
    const adDecrypt = new Uint8Array([4, 5, 6]);

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, adEncrypt, key);

    expect(() => adapter.aeadDecrypt(ciphertext, nonce, adDecrypt, key)).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ name: "secret" }));
    const key = adapter.aeadKeygen();

    const { ciphertext, nonce } = adapter.aeadEncrypt(plaintext, null, key);

    // Flip a byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    const original = tampered[0] ?? 0;
    tampered[0] = original ^ 0xff;

    expect(() => adapter.aeadDecrypt(tampered, nonce, null, key)).toThrow();
  });
});
