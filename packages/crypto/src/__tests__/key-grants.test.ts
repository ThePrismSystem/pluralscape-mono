import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { generateBucketKey } from "../bucket-keys.js";
import { AEAD_KEY_BYTES, BOX_MAC_BYTES, BOX_NONCE_BYTES } from "../constants.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { createKeyGrant, createKeyGrants, decryptKeyGrant } from "../key-grants.js";
import { getSodium } from "../sodium.js";
import { decrypt, encrypt } from "../symmetric.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { BoxKeypair } from "../types.js";
import type { BucketId } from "@pluralscape/types";

beforeAll(setupSodium);
afterAll(teardownSodium);

function makeBucketId(s = "bucket-abc"): BucketId {
  return s as BucketId;
}

function makeBoxKeypair(): BoxKeypair {
  return getSodium().boxKeypair();
}

// Envelope size: 2 (uint16le id length) + idBytes.length + 4 (uint32le version) + 32 (bucket key)
function expectedBlobLength(bucketId: BucketId): number {
  const idBytes = new TextEncoder().encode(bucketId);
  const envelopeLen = 2 + idBytes.length + 4 + AEAD_KEY_BYTES;
  return BOX_NONCE_BYTES + BOX_MAC_BYTES + envelopeLen;
}

// ── Phase 1: Core roundtrip ──────────────────────────────────────────

describe("createKeyGrant", () => {
  it("returns a blob with a non-empty encryptedBucketKey", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(blob.encryptedBucketKey.length).toBeGreaterThan(0);
  });

  it("same inputs produce different blobs (unique nonce per call)", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();
    const params = {
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    };

    const blob1 = createKeyGrant(params);
    const blob2 = createKeyGrant(params);

    expect(blob1.encryptedBucketKey).not.toEqual(blob2.encryptedBucketKey);
  });

  it("blob has expected byte length", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId("my-bucket");

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(blob.encryptedBucketKey.length).toBe(expectedBlobLength(bucketId));
  });

  it("roundtrip: createKeyGrant then decryptKeyGrant recovers original key", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    const recovered = decryptKeyGrant({
      encryptedBucketKey: blob.encryptedBucketKey,
      bucketId,
      keyVersion: 1,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: recipient.secretKey,
    });

    expect(recovered).toEqual(bucketKey);
  });

  it("wrong recipient secret key throws DecryptionFailedError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const wrongRecipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId,
        keyVersion: 1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: wrongRecipient.secretKey,
      }),
    ).toThrow(DecryptionFailedError);
  });

  it("wrong sender public key throws DecryptionFailedError", () => {
    const sender = makeBoxKeypair();
    const impostor = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId,
        keyVersion: 1,
        senderPublicKey: impostor.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(DecryptionFailedError);
  });

  it("tampered ciphertext throws DecryptionFailedError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    const tampered = new Uint8Array(blob.encryptedBucketKey);
    const firstCiphertextByte = tampered[BOX_NONCE_BYTES];
    if (firstCiphertextByte === undefined) throw new Error("blob too short to tamper");
    tampered[BOX_NONCE_BYTES] = firstCiphertextByte ^ 0xff;

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: tampered,
        bucketId,
        keyVersion: 1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(DecryptionFailedError);
  });

  it("mismatched bucketId throws InvalidInputError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId("bucket-a");

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId: makeBucketId("bucket-b"),
        keyVersion: 1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("mismatched keyVersion throws InvalidInputError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId,
        keyVersion: 2,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });
});

// ── Phase 2: Validation + safety ────────────────────────────────────

describe("input validation", () => {
  it("negative keyVersion throws InvalidInputError on create", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();

    expect(() =>
      createKeyGrant({
        bucketKey,
        bucketId: makeBucketId(),
        keyVersion: -1,
        recipientPublicKey: recipient.publicKey,
        senderSecretKey: sender.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("fractional keyVersion throws InvalidInputError on create", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();

    expect(() =>
      createKeyGrant({
        bucketKey,
        bucketId: makeBucketId(),
        keyVersion: 1.5,
        recipientPublicKey: recipient.publicKey,
        senderSecretKey: sender.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("negative keyVersion on decrypt throws InvalidInputError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId,
        keyVersion: -1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("truncated blob throws InvalidInputError", () => {
    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();

    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: new Uint8Array(10),
        bucketId: makeBucketId(),
        keyVersion: 1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: recipient.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("envelope is memzeroed after create", () => {
    const adapter = getSodium();
    const memzeroSpy = vi.spyOn(adapter, "memzero");

    const sender = makeBoxKeypair();
    const recipient = makeBoxKeypair();
    const bucketKey = generateBucketKey();

    createKeyGrant({
      bucketKey,
      bucketId: makeBucketId(),
      keyVersion: 1,
      recipientPublicKey: recipient.publicKey,
      senderSecretKey: sender.secretKey,
    });

    expect(memzeroSpy).toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});

// ── Phase 3: Batch ───────────────────────────────────────────────────

describe("createKeyGrants (batch)", () => {
  it("encrypts for 3 recipients, each grant is independently decryptable", () => {
    const sender = makeBoxKeypair();
    const alice = makeBoxKeypair();
    const bob = makeBoxKeypair();
    const carol = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blobs = createKeyGrants({
      bucketKey,
      bucketId,
      keyVersion: 2,
      recipientPublicKeys: [alice.publicKey, bob.publicKey, carol.publicKey],
      senderSecretKey: sender.secretKey,
    });

    expect(blobs).toHaveLength(3);

    for (const [i, kp] of [alice, bob, carol].entries()) {
      const blob = blobs[i];
      if (!blob) throw new Error(`Missing blob at index ${String(i)}`);
      const recovered = decryptKeyGrant({
        encryptedBucketKey: blob.encryptedBucketKey,
        bucketId,
        keyVersion: 2,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: kp.secretKey,
      });
      expect(recovered).toEqual(bucketKey);
    }
  });

  it("batch blobs have unique nonces (different ciphertexts)", () => {
    const sender = makeBoxKeypair();
    const alice = makeBoxKeypair();
    const bob = makeBoxKeypair();
    const bucketKey = generateBucketKey();

    const blobs = createKeyGrants({
      bucketKey,
      bucketId: makeBucketId(),
      keyVersion: 1,
      recipientPublicKeys: [alice.publicKey, bob.publicKey],
      senderSecretKey: sender.secretKey,
    });

    expect(blobs[0]?.encryptedBucketKey).not.toEqual(blobs[1]?.encryptedBucketKey);
  });

  it("empty recipients array throws InvalidInputError", () => {
    const sender = makeBoxKeypair();
    const bucketKey = generateBucketKey();

    expect(() =>
      createKeyGrants({
        bucketKey,
        bucketId: makeBucketId(),
        keyVersion: 1,
        recipientPublicKeys: [],
        senderSecretKey: sender.secretKey,
      }),
    ).toThrow(InvalidInputError);
  });

  it("friend A cannot decrypt friend B's grant", () => {
    const sender = makeBoxKeypair();
    const alice = makeBoxKeypair();
    const bob = makeBoxKeypair();
    const bucketKey = generateBucketKey();
    const bucketId = makeBucketId();

    const blobs = createKeyGrants({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKeys: [alice.publicKey, bob.publicKey],
      senderSecretKey: sender.secretKey,
    });

    // Bob tries to decrypt Alice's grant
    const aliceBlob = blobs[0];
    if (!aliceBlob) throw new Error("Missing blob at index 0");
    expect(() =>
      decryptKeyGrant({
        encryptedBucketKey: aliceBlob.encryptedBucketKey,
        bucketId,
        keyVersion: 1,
        senderPublicKey: sender.publicKey,
        recipientSecretKey: bob.secretKey,
      }),
    ).toThrow(DecryptionFailedError);
  });
});

// ── Phase 4: Integration ─────────────────────────────────────────────

describe("full lifecycle integration", () => {
  it("generate key, encrypt data, create grant, friend decrypts grant, friend decrypts data", () => {
    const sender = makeBoxKeypair();
    const friend = makeBoxKeypair();

    // 1. System generates a bucket key and encrypts some content with it
    const bucketKey = generateBucketKey();
    const plaintext = new TextEncoder().encode("private plural journal entry");
    const encryptedContent = encrypt(plaintext, bucketKey);

    // 2. System creates a key grant for the friend
    const bucketId = makeBucketId("journal-bucket");
    const blob = createKeyGrant({
      bucketKey,
      bucketId,
      keyVersion: 1,
      recipientPublicKey: friend.publicKey,
      senderSecretKey: sender.secretKey,
    });

    // 3. Friend decrypts the grant to recover the bucket key
    const recoveredKey = decryptKeyGrant({
      encryptedBucketKey: blob.encryptedBucketKey,
      bucketId,
      keyVersion: 1,
      senderPublicKey: sender.publicKey,
      recipientSecretKey: friend.secretKey,
    });

    // 4. Friend uses the recovered key to decrypt the content
    const recoveredContent = decrypt(encryptedContent, recoveredKey);

    expect(recoveredContent).toEqual(plaintext);
  });
});
