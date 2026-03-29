import { assertAeadKey, initSodium } from "@pluralscape/crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptWebhookPayload } from "../../services/webhook-payload-encryption.js";

beforeAll(async () => {
  await initSodium();
});

function makeTestKey() {
  const key = new Uint8Array(32).fill(0xab);
  assertAeadKey(key);
  return key;
}

// -- encryptWebhookPayload ------------------------------------------------

describe("encryptWebhookPayload", () => {
  it("returns a non-empty Uint8Array that differs from the plaintext bytes", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"member.created","systemId":"sys_test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);

    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(Buffer.from(encrypted).toString()).not.toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (nonce varies)", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"member.created"}';

    const encrypted1 = encryptWebhookPayload(plaintext, key);
    const encrypted2 = encryptWebhookPayload(plaintext, key);

    // Extremely unlikely to collide with random nonces
    expect(encrypted1).not.toEqual(encrypted2);
  });

  it("output length exceeds plaintext length (nonce + MAC overhead)", () => {
    const key = makeTestKey();
    const plaintext = '{"event":"test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });
});
