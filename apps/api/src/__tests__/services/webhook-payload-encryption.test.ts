import { describe, expect, it } from "vitest";

import { encryptWebhookPayload } from "../../services/webhook-payload-encryption.js";

// -- encryptWebhookPayload ------------------------------------------------

describe("encryptWebhookPayload", () => {
  it("returns an encrypted payload that differs from the input", () => {
    const key = Buffer.alloc(32, 0xab); // 256-bit key
    const plaintext = '{"event":"member.created","systemId":"sys_test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it("produces different ciphertexts for the same input (nonce varies)", () => {
    const key = Buffer.alloc(32, 0xab);
    const plaintext = '{"event":"member.created"}';

    const encrypted1 = encryptWebhookPayload(plaintext, key);
    const encrypted2 = encryptWebhookPayload(plaintext, key);

    // Extremely unlikely to collide with random nonces
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("output is valid base64", () => {
    const key = Buffer.alloc(32, 0xab);
    const plaintext = '{"event":"test"}';

    const encrypted = encryptWebhookPayload(plaintext, key);
    const decoded = Buffer.from(encrypted, "base64");
    expect(decoded.length).toBeGreaterThan(0);
    // Re-encode should match
    expect(decoded.toString("base64")).toBe(encrypted);
  });
});
