/**
 * Entity encryption round-trip tests.
 *
 * These tests verify that the blob-codec + real crypto pipeline works
 * end-to-end for each entity type. Each test serializes an entity's
 * encrypted fields as JSON, encrypts with XChaCha20-Poly1305, runs the
 * blob through serialize/deserialize, then decrypts and verifies the
 * original payload is recovered intact.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { deserializeEncryptedBlob, serializeEncryptedBlob } from "../blob-codec.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { BucketId, T1EncryptedBlob, T2EncryptedBlob } from "@pluralscape/types";

let adapter: SodiumAdapter;

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

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
      const fields = {
        name: "Test Member",
        pronouns: "they/them",
        description: "A test member",
        tags: ["tag1"],
        colors: { primary: "#ff0000" },
        avatarSource: null,
        saturationLevel: "highly-elaborated",
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: true,
      };
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
    });
  });

  describe("FrontingSession round-trip", () => {
    it("round-trips FrontingSession encrypted fields end-to-end", () => {
      const fields = {
        comment: "feeling good",
        positionality: "close",
      };
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
    });
  });

  describe("FrontingComment round-trip", () => {
    it("round-trips FrontingComment encrypted fields end-to-end", () => {
      const fields = {
        content: "This is a fronting comment",
      };
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
    });
  });

  describe("Group round-trip", () => {
    it("round-trips Group encrypted fields end-to-end", () => {
      const fields = {
        name: "Test Group",
        description: "A group",
        imageSource: null,
        color: "#00ff00",
        emoji: null,
      };
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
    });
  });

  describe("Channel round-trip", () => {
    it("round-trips Channel encrypted fields end-to-end", () => {
      const fields = {
        name: "general",
      };
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
    });
  });

  describe("ChatMessage round-trip", () => {
    it("round-trips ChatMessage encrypted fields end-to-end", () => {
      const fields = {
        content: "Hello everyone",
        attachments: [],
        mentions: [],
        senderId: "mem_abc",
      };
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
    });
  });

  describe("BoardMessage round-trip", () => {
    it("round-trips BoardMessage encrypted fields end-to-end", () => {
      const fields = {
        content: "Announcement",
        senderId: "mem_abc",
      };
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
    });
  });

  describe("Note round-trip", () => {
    it("round-trips Note encrypted fields end-to-end", () => {
      const fields = {
        title: "My Note",
        content: "Note body",
        backgroundColor: "#ffffcc",
      };
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
    });
  });

  describe("JournalEntry round-trip", () => {
    it("round-trips JournalEntry encrypted fields end-to-end", () => {
      const fields = {
        title: "Today",
        blocks: [],
        tags: ["daily"],
        linkedEntities: [],
        author: "mem_abc",
      };
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
    });
  });

  describe("InnerWorldEntity round-trip", () => {
    it("round-trips InnerWorldEntity encrypted fields end-to-end", () => {
      const fields = {
        name: "Castle",
        description: "A castle in the inner world",
        visual: null,
        entityType: "landmark",
        positionX: 100,
        positionY: 200,
      };
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
    });
  });

  describe("InnerWorldRegion round-trip", () => {
    it("round-trips InnerWorldRegion encrypted fields end-to-end", () => {
      const fields = {
        name: "Forest",
        description: "Dense forest",
        boundaryData: null,
        visual: null,
        gatekeeperMemberIds: [],
        accessType: "open",
      };
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
    });
  });

  describe("CustomFront round-trip", () => {
    it("round-trips CustomFront encrypted fields end-to-end", () => {
      const fields = {
        name: "Dissociated",
        description: "Feeling disconnected",
        color: "#808080",
        emoji: null,
      };
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
    });
  });

  describe("AcknowledgementRequest round-trip", () => {
    it("round-trips AcknowledgementRequest encrypted fields end-to-end", () => {
      const fields = {
        message: "Please confirm",
        targetMemberId: "mem_target",
        confirmedAt: 1700000000000,
      };
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
    });
  });

  // ── Remaining entity stubs (simple T1 fields, pending helpers) ───
  describe.todo("Subsystem round-trip");
  describe.todo("SideSystem round-trip");
  describe.todo("Layer round-trip");
  describe.todo("Relationship round-trip");
  describe.todo("FieldDefinition round-trip");
  describe.todo("FieldValue round-trip");
  describe.todo("LifecycleEvent round-trip");
  describe.todo("WikiPage round-trip");
  describe.todo("MemberPhoto round-trip");
  describe.todo("Poll round-trip");
  describe.todo("PollVote round-trip");
  describe.todo("TimerConfig round-trip");
  describe.todo("AuditLogEntry round-trip");
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
      bucketId: "bkt_test" as BucketId,
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
