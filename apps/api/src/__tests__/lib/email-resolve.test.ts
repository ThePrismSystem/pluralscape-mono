import { initSodium } from "@pluralscape/crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveAccountEmail } from "../../lib/email-resolve.js";

const mockEnv = vi.hoisted(() => ({
  EMAIL_ENCRYPTION_KEY: undefined as string | undefined,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

/** Valid 64-char hex key (32 bytes of 0xaa). */
const VALID_KEY_HEX = "aa".repeat(32);

beforeAll(async () => {
  await initSodium();
});

describe("resolveAccountEmail", () => {
  afterEach(() => {
    mockEnv.EMAIL_ENCRYPTION_KEY = undefined;
  });

  it("returns null when account does not exist", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    const result = await resolveAccountEmail(mockDb as never, "acc_nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when encrypted_email is null (pre-migration account)", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ encryptedEmail: null }]),
    };

    const result = await resolveAccountEmail(mockDb as never, "acc_legacy");
    expect(result).toBeNull();
  });

  it("decrypts and returns email when present", async () => {
    mockEnv.EMAIL_ENCRYPTION_KEY = VALID_KEY_HEX;

    // Encrypt an email to get realistic ciphertext
    const { encryptEmail } = await import("../../lib/email-encrypt.js");
    const encrypted = encryptEmail("alice@example.com");

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ encryptedEmail: encrypted }]),
    };

    const result = await resolveAccountEmail(mockDb as never, "acc_123");
    expect(result).toBe("alice@example.com");
  });
});
