/**
 * Entity encryption round-trip tests.
 *
 * These tests verify that the blob-codec + real crypto pipeline works
 * end-to-end for each entity type. Most are scaffolded as `describe.todo()`
 * pending entity-level encrypt/decrypt helpers in packages/crypto.
 *
 * The one working test proves the pipeline: generate key → encrypt → serialize
 * → deserialize → decrypt → plaintext matches.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { deserializeEncryptedBlob, serializeEncryptedBlob } from "../blob-codec.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { EncryptedBlob } from "@pluralscape/types";

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

    // Package as EncryptedBlob
    const blob: EncryptedBlob = {
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

  // ── Entity-type scaffolds ──────────────────────────────────────
  // Blocked by entity-level encrypt/decrypt helpers (packages/crypto).
  // Each describe.todo() will become a full test suite once those helpers exist.

  describe.todo("Member round-trip");
  describe.todo("FrontingSession round-trip");
  describe.todo("FrontingComment round-trip");
  describe.todo("Group round-trip");
  describe.todo("Subsystem round-trip");
  describe.todo("SideSystem round-trip");
  describe.todo("Layer round-trip");
  describe.todo("Relationship round-trip");
  describe.todo("Channel round-trip");
  describe.todo("ChatMessage round-trip");
  describe.todo("BoardMessage round-trip");
  describe.todo("Note round-trip");
  describe.todo("FieldDefinition round-trip");
  describe.todo("FieldValue round-trip");
  describe.todo("InnerWorldEntity round-trip");
  describe.todo("InnerWorldRegion round-trip");
  describe.todo("LifecycleEvent round-trip");
  describe.todo("CustomFront round-trip");
  describe.todo("JournalEntry round-trip");
  describe.todo("WikiPage round-trip");
  describe.todo("MemberPhoto round-trip");
  describe.todo("Poll round-trip");
  describe.todo("PollVote round-trip");
  describe.todo("AcknowledgementRequest round-trip");
  describe.todo("TimerConfig round-trip");
  describe.todo("AuditLogEntry round-trip");
});
